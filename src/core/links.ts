import { foldKey } from './fold'

export interface LinkRef {
  target: string
  label: string | null
  line: string
}

const WIKI = /(!?)\[\[([^[\]|\n]+?)(?:\|([^[\]\n]+?))?\]\]/g
const CONTEXT_MAX = 238

/**
 * Markdown'ı satır satır gezer; kod blokları ve satır içi kod dışındaki parçaları `fn` ile dönüştürür.
 * Kod parçaları olduğu gibi kalır (yeniden adlandırma ve çıkarım kodu görmez).
 */
function mapProse(md: string, fn: (text: string, lineIndex: number) => string): string {
  let fence: string | null = null
  return md
    .split('\n')
    .map((line, i) => {
      const f = /^\s*(```+|~~~+)/.exec(line)
      if (f) {
        if (fence === null) fence = f[1]![0]!
        else if (f[1]![0] === fence) fence = null
        return line
      }
      if (fence !== null) return line
      return line
        .split(/(`+[^`]*`+)/)
        .map((part) => (part.startsWith('`') ? part : fn(part, i)))
        .join('')
    })
    .join('\n')
}

/** Satırdaki linkleri görünen metinle değiştirip okunabilir bağlam cümlesi üretir; uzunsa linkin çevresinden keser */
function contextOf(rawLine: string, target: string): string {
  const plain = rawLine.replace(WIKI, (_m, bang: string, t: string, l?: string) => (bang ? '' : (l ?? t).trim())).trim()
  if (plain.length <= CONTEXT_MAX) return plain
  const at = Math.max(0, plain.indexOf(target))
  const start = Math.max(0, Math.min(at - CONTEXT_MAX / 2, plain.length - CONTEXT_MAX))
  const cut = plain.slice(start, start + CONTEXT_MAX)
  return (start > 0 ? '…' : '') + cut.slice(start > 0 ? 1 : 0) + (start + CONTEXT_MAX < plain.length ? '…' : '')
}

/** Gövdedeki [[link]]'leri bağlam satırıyla döndürür (gömülü ![[...]] ve kod hariç) */
export function extractLinks(body: string): LinkRef[] {
  const out: LinkRef[] = []
  const lines = body.split('\n')
  mapProse(body, (text, i) => {
    for (const m of text.matchAll(WIKI)) {
      if (m[1]) continue
      const target = m[2]!.trim()
      out.push({ target, label: m[3] ? m[3].trim() : null, line: contextOf(lines[i]!, m[3]?.trim() ?? target) })
    }
    return text
  })
  return out
}

const TAG = /(^|[\s(\[{,;])#([\p{L}\p{N}_][\p{L}\p{N}_\-/]*)/gu

/** Etiketler: önce frontmatter `tags`, sonra metindeki #etiket; katlanmış ve tekil */
export function extractTags(body: string, frontmatterTags?: unknown): string[] {
  // anahtar katlanmış biçim (I/ı/İ eşit), gösterilen ilk görülen küçük harfli biçim
  const seen = new Map<string, string>()
  const add = (raw: string) => {
    const t = raw.trim().replace(/^#/, '').replace(/[-/]+$/, '').replace(/İ/g, 'i').toLowerCase()
    const k = foldKey(t)
    if (k && /\p{L}/u.test(k) && !seen.has(k)) seen.set(k, t)
  }
  if (Array.isArray(frontmatterTags)) frontmatterTags.forEach((x) => typeof x === 'string' && add(x))
  else if (typeof frontmatterTags === 'string') add(frontmatterTags)
  mapProse(body, (text) => {
    for (const m of text.matchAll(TAG)) add(m[2]!)
    return text
  })
  return [...seen.values()]
}

const normTarget = (t: string) => foldKey(t.trim().replace(/\.md$/i, ''))

/** `oldTargets`'tan birine giden linkleri `newTarget`'a çevirir; görünen ad ve kod korunur */
export function renameLinks(body: string, oldTargets: string[], newTarget: string): string {
  const olds = new Set(oldTargets.map(normTarget))
  const next = mapProse(body, (text) =>
    text.replace(WIKI, (m, bang: string, t: string, label?: string) => {
      if (bang || !olds.has(normTarget(t))) return m
      return `[[${newTarget}${label !== undefined ? `|${label}` : ''}]]`
    })
  )
  return next === body ? body : next
}
