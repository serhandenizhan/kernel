import type { JSONContent } from '@tiptap/core'
import type { NotionRichText } from './types'
import type { ConvertContext } from './convert'

type Mark = NonNullable<JSONContent['marks']>[number]

// Notion renk adı → Kernel vurgu rengi (arka plan ve metin renkleri aynı tona; Kernel'de metin rengi işareti yok)
export const HIGHLIGHT_COLOR_MAP: Record<string, string> = { yellow: 'yellow', orange: 'yellow', green: 'green', blue: 'blue', pink: 'pink', red: 'pink', purple: 'purple', gray: 'gray', brown: 'gray' }

export const formatNotionDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

function marksOf(rt: NotionRichText): Mark[] {
  const a = rt.annotations
  const marks: Mark[] = []
  const href = rt.text?.link?.url ?? rt.href
  if (href && rt.type === 'text') marks.push({ type: 'link', attrs: { href } })
  if (a.strikethrough) marks.push({ type: 'strike' })
  if (a.bold) marks.push({ type: 'bold' })
  if (a.italic) marks.push({ type: 'italic' })
  if (a.underline) marks.push({ type: 'underline' })
  const color = HIGHLIGHT_COLOR_MAP[a.color.replace('_background', '')]
  if (a.color !== 'default' && color) marks.push({ type: 'highlight', attrs: { color } })
  if (a.code) marks.push({ type: 'code' })
  return marks
}

const textNode = (text: string, marks: Mark[]): JSONContent => (marks.length ? { type: 'text', text, marks } : { type: 'text', text })

export function richTextToInline(rts: NotionRichText[] | undefined, ctx: ConvertContext): JSONContent[] {
  const out: JSONContent[] = []
  for (const rt of rts ?? []) {
    if (rt.type === 'equation' && rt.equation) {
      out.push({ type: 'inlineMath', attrs: { latex: rt.equation.expression } })
      continue
    }
    if (rt.type === 'mention' && rt.mention) {
      const m = rt.mention
      if (m.type === 'page' && m.page) {
        out.push({ type: 'wikiLink', attrs: { target: ctx.pageTitle(m.page.id) ?? rt.plain_text, label: null } })
      } else if (m.type === 'date' && m.date) {
        out.push(textNode(formatNotionDate(m.date.start) + (m.date.end ? ` → ${formatNotionDate(m.date.end)}` : ''), []))
      } else if (m.type === 'user') {
        out.push(textNode(`@${m.user?.name ?? rt.plain_text.replace(/^@/, '')}`, []))
      } else if (m.type === 'link_preview' && rt.href) {
        out.push(textNode(rt.plain_text, [{ type: 'link', attrs: { href: rt.href } }]))
      } else {
        out.push(textNode(rt.plain_text, []))
      }
      continue
    }
    const text = rt.text?.content ?? rt.plain_text
    if (text) out.push(textNode(text, marksOf(rt)))
  }
  // aynı işaretli ardışık metinleri birleştir
  const merged: JSONContent[] = []
  for (const n of out) {
    const prev = merged[merged.length - 1]
    if (n.type === 'text' && prev?.type === 'text' && JSON.stringify(prev.marks ?? []) === JSON.stringify(n.marks ?? [])) prev.text = (prev.text ?? '') + (n.text ?? '')
    else merged.push(n)
  }
  return merged
}

export const plainText = (rts: NotionRichText[] | undefined): string => (rts ?? []).map((r) => r.plain_text).join('')
