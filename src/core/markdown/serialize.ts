import { unified } from 'unified'
import remarkStringify from 'remark-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { BlockContent, PhrasingContent, Root, RootContent, TableRow, ListItem } from 'mdast'
import { MARK_ORDER, type JSONContent } from './schema'

type Mark = NonNullable<JSONContent['marks']>[number]

const processor = unified()
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkStringify, {
    bullet: '-',
    fences: true,
    rule: '-',
    emphasis: '*',
    strong: '*',
    listItemIndent: 'one',
    // "a == b" yeniden açılınca vurgu olmasın
    unsafe: [{ character: '=', after: '=', inConstruct: 'phrasing' }, { character: '=', before: '=', inConstruct: 'phrasing' }]
  })

// TipTap belgesini Kernel Markdown'ına çevirir
export function docToMarkdown(doc: JSONContent): string {
  const root: Root = { type: 'root', children: blocks(doc.content ?? []) as RootContent[] }
  const out = processor.stringify(root)
  return out.trim() ? out.replace(/\n*$/, '\n') : ''
}

function phrasingToMarkdown(content: JSONContent[]): string {
  return processor.stringify({ type: 'root', children: [{ type: 'paragraph', children: inline(content) }] }).trim()
}

function blocks(nodes: JSONContent[]): BlockContent[] {
  return nodes.flatMap(block)
}

function block(n: JSONContent): BlockContent[] {
  const c = n.content ?? []
  switch (n.type) {
    case 'paragraph': {
      const kids = inline(c)
      return kids.length ? [{ type: 'paragraph', children: kids }] : []
    }
    case 'heading':
      return [{ type: 'heading', depth: Math.min(6, Math.max(1, Number(n.attrs?.['level'] ?? 1))) as 1, children: inline(c) }]
    case 'horizontalRule':
      return [{ type: 'thematicBreak' }]
    case 'blockquote':
      return [{ type: 'blockquote', children: blocks(c) }]
    case 'callout': {
      const a = n.attrs ?? {}
      const head = `[!${a['type'] ?? 'note'}${a['icon'] ? `|${a['icon']}` : ''}]${a['title'] ? ` ${a['title']}` : ''}`
      return [{ type: 'blockquote', children: [{ type: 'html', value: head } as unknown as BlockContent, ...blocks(c)] }]
    }
    case 'details': {
      const summary = c.find((x) => x.type === 'detailsSummary')
      const body = c.find((x) => x.type === 'detailsContent')
      const open = `<details${n.attrs?.['card'] ? ' data-card' : ''}>\n<summary>${phrasingToMarkdown(summary?.content ?? [])}</summary>`
      return [{ type: 'html', value: open }, ...blocks(body?.content ?? []), { type: 'html', value: '</details>' }]
    }
    case 'bulletList':
    case 'orderedList':
    case 'taskList': {
      const ordered = n.type === 'orderedList'
      return [
        {
          type: 'list',
          ordered,
          start: ordered ? Number(n.attrs?.['start'] ?? 1) : null,
          spread: false,
          children: c.map(
            (li): ListItem => ({
              type: 'listItem',
              spread: false,
              checked: n.type === 'taskList' ? Boolean(li.attrs?.['checked']) : null,
              children: blocks(li.content ?? [])
            })
          )
        }
      ]
    }
    case 'codeBlock':
      return [{ type: 'code', lang: (n.attrs?.['language'] as string | null) ?? null, meta: n.attrs?.['lineNumbers'] ? '{lineNumbers}' : null, value: c.map((t) => t.text ?? '').join('') }]
    case 'blockMath':
      return [{ type: 'math', value: String(n.attrs?.['latex'] ?? '') } as unknown as BlockContent]
    case 'image': {
      const a = n.attrs ?? {}
      const alt = `${a['alt'] ?? ''}${a['width'] ? `|${a['width']}` : ''}`
      const children: PhrasingContent[] = [{ type: 'image', url: String(a['src'] ?? ''), alt }]
      if (a['caption']) children.push({ type: 'text', value: '\n' }, { type: 'emphasis', children: [{ type: 'text', value: String(a['caption']) }] })
      return [{ type: 'paragraph', children }]
    }
    case 'table': {
      const rows = c
      const align = (rows[0]?.content ?? []).map((cell) => (cell.attrs?.['align'] as 'left' | 'right' | 'center' | null) ?? null)
      return [
        {
          type: 'table',
          align,
          children: rows.map(
            (row): TableRow => ({
              type: 'tableRow',
              children: (row.content ?? []).map((cell) => ({ type: 'tableCell', children: inline((cell.content ?? []).flatMap((p) => p.content ?? [])) }))
            })
          )
        }
      ]
    }
    default:
      return c.length ? blocks(c) : []
  }
}

// --- satır içi: ardışık düğümleri ortak işaretlerine göre gruplayarak iç içe yapı kurar ---

interface Item {
  node: JSONContent
  marks: Mark[]
}

const sameMark = (a: Mark, b: Mark) => a.type === b.type && JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {})

function inline(nodes: JSONContent[]): PhrasingContent[] {
  return build(nodes.map((node) => ({ node, marks: [...(node.marks ?? [])] })))
}

function build(items: Item[]): PhrasingContent[] {
  const out: PhrasingContent[] = []
  let i = 0
  while (i < items.length) {
    const item = items[i]!
    const outer = MARK_ORDER.map((t) => item.marks.find((m) => m.type === t)).find((m) => m && m.type !== 'code')
    if (!outer) {
      out.push(...leaf(item))
      i++
      continue
    }
    let j = i
    while (j < items.length && items[j]!.marks.some((m) => sameMark(m, outer))) j++
    const inner = build(items.slice(i, j).map((it) => ({ node: it.node, marks: it.marks.filter((m) => !sameMark(m, outer)) })))
    out.push(...wrap(outer, inner))
    i = j
  }
  return out
}

function wrap(mark: Mark, children: PhrasingContent[]): PhrasingContent[] {
  switch (mark.type) {
    case 'bold':
      return [{ type: 'strong', children }]
    case 'italic':
      return [{ type: 'emphasis', children }]
    case 'strike':
      return [{ type: 'delete', children }]
    case 'link':
      return [{ type: 'link', url: String(mark.attrs?.['href'] ?? ''), children }]
    case 'underline':
      return [{ type: 'html', value: '<u>' }, ...children, { type: 'html', value: '</u>' }]
    case 'highlight': {
      const color = mark.attrs?.['color']
      return [{ type: 'html', value: color ? `<mark data-color="${color}">` : '<mark>' }, ...children, { type: 'html', value: '</mark>' }]
    }
    default:
      return children
  }
}

function leaf(item: Item): PhrasingContent[] {
  const n = item.node
  if (n.type === 'hardBreak') return [{ type: 'break' }]
  if (n.type === 'inlineMath') return [{ type: 'inlineMath', value: String(n.attrs?.['latex'] ?? '') } as unknown as PhrasingContent]
  if (n.type !== 'text' || !n.text) return []
  if (item.marks.some((m) => m.type === 'code')) return [{ type: 'inlineCode', value: n.text }]
  return [{ type: 'text', value: n.text }]
}
