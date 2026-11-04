// Repodaki dosyalar ile test/fixtures/private (kullanıcının gerçek notları, gitignore'lu) arasında örtüşme arar.
// Özel içerik asla yazdırılmaz; yalnızca dosya ve satır numarası raporlanır.
// Kullanım: npm run check:private   (temizse 0, örtüşme varsa 1 ile çıkar)
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const norm = (l) => l.replace(/[\s*`#>\-|]+/g, ' ').trim().toLowerCase()
const words = (t) => t.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []
const grams = (ws) => {
  const out = new Set()
  for (let i = 0; i + 6 <= ws.length; i++) out.add(ws.slice(i, i + 6).join(' '))
  return out
}

/** @returns {{ path: string, line: number, kind: 'line' | 'phrase' }[]} */
export function findOverlaps(privateTexts, files) {
  const lines = new Set()
  const phrases = new Set()
  for (const t of privateTexts) {
    for (const l of t.split('\n')) {
      const n = norm(l)
      if (n.length >= 18) lines.add(n)
    }
    for (const g of grams(words(t))) phrases.add(g)
  }
  const hits = []
  for (const f of files) {
    f.text.split('\n').forEach((l, i) => {
      const n = norm(l)
      if (n.length >= 18 && lines.has(n)) hits.push({ path: f.path, line: i + 1, kind: 'line' })
      else if ([...grams(words(l))].some((g) => phrases.has(g))) hits.push({ path: f.path, line: i + 1, kind: 'phrase' })
    })
  }
  return hits
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const dir = join('test', 'fixtures', 'private')
  if (!existsSync(dir)) {
    console.log('Özel örnek klasörü yok; kontrol atlandı.')
    process.exit(0)
  }
  const privateTexts = readdirSync(dir)
    .filter((f) => !f.startsWith('.'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .filter((p) => p && !/\.(png|icns|jpe?g|pdf|zip)$/i.test(p) && p !== 'package-lock.json' && !p.startsWith('test/fixtures/private/'))
  const files = tracked.filter((p) => existsSync(p)).map((p) => ({ path: p, text: readFileSync(p, 'utf8') }))
  const hits = findOverlaps(privateTexts, files)
  if (hits.length) {
    console.error(`Özel notlarla örtüşme bulundu (${hits.length}):`)
    for (const h of hits) console.error(`  ${h.path}:${h.line} (${h.kind})`)
    process.exit(1)
  }
  console.log(`Temiz: ${files.length} dosya tarandı, özel notlarla örtüşme yok.`)
}
