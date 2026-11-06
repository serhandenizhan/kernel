// Sürüm notlarını güncelleme penceresi için sadeleştirir (saf).
// Notta <!-- tr --> / <!-- en --> / <!-- de --> bölümleri varsa arayüz dilindeki seçilir;
// GitHub'ın otomatik notundaki teknik satırlar (PR bağlantıları, katkıcılar, karşılaştırma) atılır.

export type NoteLine = { kind: 'heading' | 'item' | 'text'; text: string }

const SECTION = /<!--\s*(tr|en|de)\s*-->/gi

function pickSection(body: string, lang: string): string {
  const marks = [...body.matchAll(SECTION)]
  if (marks.length === 0) return body
  const sections = new Map<string, string>()
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1]!.index! : body.length
    sections.set(m[1]!.toLowerCase(), body.slice(m.index! + m[0].length, end))
  })
  return sections.get(lang) ?? sections.get('en') ?? sections.get('tr') ?? ''
}

function plain(s: string): string {
  return s
    .replace(/\s+by @[\w-]+ in https?:\/\/\S+$/i, '')
    .replace(/\s+in https?:\/\/github\.com\/\S+\/pull\/\d+$/i, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

/** Geleneksel commit önekini (feat:, fix(x):) atar, ilk harfi büyütür */
function tidyItem(s: string): string {
  const t = s.replace(/^(feat|fix|docs|chore|ci|test|refactor|perf|style|build)(\([^)]*\))?!?:\s*/i, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function releaseNotes(body: string, lang: string): NoteLine[] {
  const out: NoteLine[] = []
  let skipping = false
  for (const raw of pickSection(body.replace(/\r\n/g, '\n'), lang).split('\n')) {
    const line = raw.trim()
    if (!line || /^<!--.*-->$/.test(line)) continue
    const h = /^#{1,6}\s+(.*)$/.exec(line)
    if (h) {
      const title = plain(h[1]!)
      // GitHub'ın kendi başlıkları gösterilmez; "New Contributors" bölümü tamamen atlanır
      skipping = /^new contributors$/i.test(title)
      if (!skipping && !/^what'?s changed$/i.test(title)) out.push({ kind: 'heading', text: title })
      continue
    }
    if (skipping) continue
    if (/^\*\*full changelog\*\*/i.test(line)) continue
    const li = /^[-*+]\s+(.*)$/.exec(line)
    if (li) {
      const text = tidyItem(plain(li[1]!))
      if (text) out.push({ kind: 'item', text })
      continue
    }
    const text = plain(line)
    if (text) out.push({ kind: 'text', text })
  }
  return out
}
