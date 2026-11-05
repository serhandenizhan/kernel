// Arayüzde sözlük dışı (sabit yazılmış) metin kalmadığını denetler: `npm run check:i18n`
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const TR = /[çğıöşüÇĞİÖŞÜ]/
const LETTER = /[A-Za-zçğıöşüÇĞİÖŞÜ]/
// kısayol gösterimleri (⌘K, ⇧⌘T) ve tek harfler metin sayılmaz
const isText = (s) => LETTER.test(s) && !/[⌘⇧⌥⌃]/.test(s) && s.trim().length > 1
const SKIP_ATTRS = /\b(className|class|data-[\w-]+|key|id|href|src|type|role|name|value|lang|rel|for|htmlFor|style)=(["'])[^"']*\2/g
const TEXT_ATTRS = /\b(title|placeholder|aria-label|label|alt)=(["'])([^"']*)\2/g

/** Yorumları satır numaralarını koruyarak siler */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

/** Kaynakta sözlük dışı arayüz metni bulunan satırlar (1 tabanlı) */
export function findHardcoded(source, jsx = true) {
  const lines = stripComments(source).split('\n')
  const out = []
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line || /^import\s/.test(line) || /\bfrom\s+['"]/.test(line)) return
    // log kayıtları arayüz metni değildir (geliştirici için, Türkçe kalır)
    if (/\blog\.(info|warn|error|debug)\(/.test(line)) return
    let hit = false
    // title / placeholder / aria-label / label / alt değerleri
    for (const m of line.matchAll(TEXT_ATTRS)) if (LETTER.test(m[3])) hit = true
    const rest = line.replace(SKIP_ATTRS, '').replace(TEXT_ATTRS, '')
    // Türkçe harf içeren string literal
    for (const m of rest.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g)) if (TR.test(m[2])) hit = true
    // aynı satırda >metin<
    // aynı satırda >metin< (yalnızca TSX; ok fonksiyonu ve TS jenerikleri hariç)
    if (jsx) for (const m of rest.matchAll(/(?<![=-])>([^<>{}()=;:]+)</g)) if (isText(m[1])) hit = true
    // tek başına satırda JSX metni (önceki satır etiketle biter, sonraki etiket/ifadeyle başlar)
    const prev = (lines[i - 1] ?? '').trim()
    const next = (lines[i + 1] ?? '').trim()
    if (jsx && />$/.test(prev) && /^[<{]/.test(next) && !/[<>{}=;()]/.test(line) && isText(line)) hit = true
    if (hit) out.push({ line: i + 1, text: line })
  })
  return out
}

const ROOTS = ['src/renderer', 'src/main']
const EXCLUDE = [/^src\/shared\/i18n\//, /^src\/renderer\/assets\/emoji-tr\.ts$/]

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url))
  let allow = []
  try {
    allow = readFileSync(join(root, 'scripts/i18n-allow.txt'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  } catch {
    // izin listesi yok
  }
  const findings = []
  for (const r of ROOTS) {
    for (const file of walk(join(root, r))) {
      // Windows'ta da izin listesi ve dışlamalar / ile yazılır
      const rel = relative(root, file).split(sep).join('/')
      if (EXCLUDE.some((re) => re.test(rel))) continue
      for (const f of findHardcoded(readFileSync(file, 'utf8'), file.endsWith('.tsx'))) {
        if (allow.some((a) => a === `${rel}:${f.text}` || (a.endsWith(':*') && a.slice(0, -2) === rel))) continue
        findings.push(`${rel}:${f.line}: ${f.text}`)
      }
    }
  }
  if (findings.length) {
    console.error(`Sözlük dışı arayüz metni (${findings.length}):\n` + findings.join('\n'))
    process.exit(1)
  }
  console.log('Temiz: sözlük dışı arayüz metni yok.')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
