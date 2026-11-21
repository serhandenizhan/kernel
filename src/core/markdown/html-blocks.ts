// <details>, <summary>, <u>, <mark> gibi Kernel'in kullandığı HTML parçalarını tanır

export const DETAILS_OPEN = /^<details((?:\s+data-[a-z]+(?:="[^"]*")?)*)\s*>/i
export const DETAILS_CLOSE = /^<\/details>\s*$/i
const DETAILS_TAG = /<\/?details\b[^>]*>/gi
const SUMMARY = /<summary>([\s\S]*?)<\/summary>/i

/** HTML içindeki <details> açılış/kapanış etiket dengesini takip eder; ilk kapanış konumunu döndürür */
export function scanDetailsBalance(html: string, initialDepth: number): { depth: number; closeAt: number; closeLen: number } {
  let depth = initialDepth
  DETAILS_TAG.lastIndex = 0
  for (let m = DETAILS_TAG.exec(html); m; m = DETAILS_TAG.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1
    if (depth === 0) return { depth: 0, closeAt: m.index, closeLen: m[0].length }
  }
  return { depth, closeAt: -1, closeLen: 0 }
}

export function parseDetailsOpen(html: string): { card: boolean; heading: number | null; summary: string; rest: string; closed: boolean; depth: number; trailing: string } | null {
  const trimmed = html.trim()
  const m = DETAILS_OPEN.exec(trimmed)
  if (!m) return null
  const after = trimmed.slice(m[0].length)
  const s = SUMMARY.exec(after)
  const attrs = m[1] ?? ''
  const h = /data-heading="([1-6])"/.exec(attrs)
  const body = s ? after.replace(SUMMARY, '') : after
  const bal = scanDetailsBalance(body, 1)
  const closed = bal.depth === 0
  return {
    card: /data-card/.test(attrs),
    heading: h ? Number(h[1]) : null,
    summary: s ? (s[1] ?? '').trim() : '',
    rest: (closed ? body.slice(0, bal.closeAt) : body).trim(),
    closed,
    depth: bal.depth,
    trailing: closed ? body.slice(bal.closeAt + bal.closeLen).trim() : ''
  }
}

export type InlineHtml =
  | { kind: 'open'; mark: 'underline' }
  | { kind: 'open'; mark: 'highlight'; color: string | null }
  | { kind: 'close'; mark: 'underline' | 'highlight' }
  | { kind: 'break' }

export function parseInlineHtml(html: string): InlineHtml | null {
  const v = html.trim()
  if (/^<u>$/i.test(v)) return { kind: 'open', mark: 'underline' }
  if (/^<\/u>$/i.test(v)) return { kind: 'close', mark: 'underline' }
  const mark = /^<mark(?:\s+data-color="([a-z]+)")?\s*>$/i.exec(v)
  if (mark) return { kind: 'open', mark: 'highlight', color: mark[1] ?? null }
  if (/^<\/mark>$/i.test(v)) return { kind: 'close', mark: 'highlight' }
  if (/^<br\s*\/?>$/i.test(v)) return { kind: 'break' }
  return null
}
