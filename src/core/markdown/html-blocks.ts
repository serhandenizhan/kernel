// <details>, <summary>, <u>, <mark> gibi Kernel'in kullandığı HTML parçalarını tanır

export const DETAILS_OPEN = /^<details((?:\s+data-[a-z]+(?:="[^"]*")?)*)\s*>/i
export const DETAILS_CLOSE = /^<\/details>\s*$/i
const SUMMARY = /<summary>([\s\S]*?)<\/summary>/i

export function parseDetailsOpen(html: string): { card: boolean; heading: number | null; summary: string; rest: string } | null {
  const m = DETAILS_OPEN.exec(html.trim())
  if (!m) return null
  const after = html.trim().slice(m[0].length)
  const s = SUMMARY.exec(after)
  const attrs = m[1] ?? ''
  const h = /data-heading="([1-6])"/.exec(attrs)
  return { card: /data-card/.test(attrs), heading: h ? Number(h[1]) : null, summary: s ? (s[1] ?? '').trim() : '', rest: s ? after.replace(SUMMARY, '').trim() : after.trim() }
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
