import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { Nodes, Parents, PhrasingContent, RootContent, List, Table } from 'mdast'
import { CALLOUT_TYPES, ESCAPED_EQ, MARK_ORDER, type CalloutType, type JSONContent } from './schema'
import { DETAILS_CLOSE, parseDetailsOpen, parseInlineHtml } from './html-blocks'

type Mark = NonNullable<JSONContent['marks']>[number]

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

// Markdown metnini TipTap belgesine (JSONContent) çevirir
export function markdownToDoc(md: string): JSONContent {
  // "\=" kaçışlarını koru: remark onları "=" yapar ve == vurgusundan ayırt edilemez hale gelirdi
  const src = md.replace(/\\=/g, ESCAPED_EQ)
  const tree = processor.parse(src)
  const content = convertBlocks(tree.children)
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

/** Satır içi Markdown parçasını (örn. <summary> içeriği) çevirir */
function parseInlineMarkdown(md: string): JSONContent[] {
  const doc = markdownToDoc(md)
  const first = doc.content?.[0]
  return first?.type === 'paragraph' ? (first.content ?? []) : []
}

const restoreText = (s: string) => s.replaceAll(ESCAPED_EQ, '=')
const restoreRaw = (s: string) => s.replaceAll(ESCAPED_EQ, '\\=')

function convertBlocks(nodes: RootContent[]): JSONContent[] {
  const out: JSONContent[] = []
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    if (node.type === 'html') {
      const open = parseDetailsOpen(node.value)
      if (open) {
        // eşleşen </details>'e kadar olan kardeşleri grupla (iç içe için derinlik sayacı)
        let depth = 1
        let j = i + 1
        for (; j < nodes.length; j++) {
          const n = nodes[j]!
          if (n.type === 'html') {
            if (parseDetailsOpen(n.value)) depth++
            else if (DETAILS_CLOSE.test(n.value.trim())) depth--
            if (depth === 0) break
          }
        }
        const inner = convertBlocks(nodes.slice(i + 1, j))
        if (open.rest) inner.unshift(...convertBlocks(processor.parse(open.rest).children))
        const summary = parseInlineMarkdown(open.summary)
        out.push({
          type: 'details',
          attrs: { card: open.card },
          content: [
            summary.length ? { type: 'detailsSummary', content: summary } : { type: 'detailsSummary' },
            { type: 'detailsContent', content: inner.length ? inner : [{ type: 'paragraph' }] }
          ]
        })
        i = j
        continue
      }
      if (DETAILS_CLOSE.test(node.value.trim())) continue
      // bilinmeyen HTML: veri kaybetmemek için metin olarak koru
      out.push({ type: 'paragraph', content: [{ type: 'text', text: restoreText(node.value) }] })
      continue
    }
    out.push(...convertBlock(node))
  }
  return out
}

function convertBlock(node: RootContent): JSONContent[] {
  switch (node.type) {
    case 'paragraph':
      return convertParagraph(node.children)
    case 'heading':
      return [withContent({ type: 'heading', attrs: { level: node.depth } }, convertInline(node.children))]
    case 'thematicBreak':
      return [{ type: 'horizontalRule' }]
    case 'blockquote':
      return [convertBlockquote(node.children)]
    case 'list':
      return [convertList(node)]
    case 'code': {
      const lineNumbers = /\{lineNumbers\}/.test(node.meta ?? '')
      const value = restoreRaw(node.value)
      return [withContent({ type: 'codeBlock', attrs: { language: node.lang ?? null, lineNumbers } }, value ? [{ type: 'text', text: value }] : [])]
    }
    case 'math':
      return [{ type: 'blockMath', attrs: { latex: restoreRaw(node.value) } }]
    case 'table':
      return [convertTable(node)]
    default:
      return []
  }
}

function withContent(node: JSONContent, content: JSONContent[]): JSONContent {
  return content.length ? { ...node, content } : node
}

function convertParagraph(children: PhrasingContent[]): JSONContent[] {
  const meaningful = children.filter((c) => !(c.type === 'text' && !c.value.trim()) && c.type !== 'break')
  // yalnızca görsel (ve isteğe bağlı *alt yazı*) içeren paragraf → görsel bloğu
  const img = meaningful[0]
  if (img?.type === 'image' && (meaningful.length === 1 || (meaningful.length === 2 && meaningful[1]!.type === 'emphasis'))) {
    const cap = meaningful[1]
    const caption = cap?.type === 'emphasis' ? cap.children.map((c) => (c.type === 'text' ? restoreText(c.value) : '')).join('') : ''
    const m = /^(.*)\|(\d+)$/.exec(img.alt ?? '')
    return [{ type: 'image', attrs: { src: img.url, alt: m ? m[1]! : (img.alt ?? ''), width: m ? Number(m[2]) : null, caption } }]
  }
  // metin içindeki görseller paragrafı böler
  const out: JSONContent[] = []
  let run: PhrasingContent[] = []
  const flush = () => {
    const content = convertInline(run)
    if (content.length) out.push({ type: 'paragraph', content })
    run = []
  }
  for (const c of children) {
    if (c.type === 'image') {
      flush()
      out.push(...convertParagraph([c]))
    } else run.push(c)
  }
  flush()
  return out.length ? out : [{ type: 'paragraph' }]
}

function convertBlockquote(children: RootContent[]): JSONContent {
  const first = children[0]
  if (first?.type === 'paragraph' && first.children[0]?.type === 'text') {
    const head = first.children[0].value
    const m = /^\[!([a-z]+)(?:\|([^\]]+))?\][ \t]*([^\n]*)(?:\n([\s\S]*))?$/i.exec(head)
    if (m) {
      const type = (CALLOUT_TYPES as readonly string[]).includes(m[1]!.toLowerCase()) ? (m[1]!.toLowerCase() as CalloutType) : 'note'
      const restFirst: PhrasingContent[] = []
      if (m[4]) restFirst.push({ type: 'text', value: m[4] })
      restFirst.push(...first.children.slice(1))
      const body: JSONContent[] = []
      if (restFirst.some((c) => c.type !== 'text' || c.value.trim())) body.push(...convertParagraph(restFirst))
      body.push(...convertBlocks(children.slice(1)))
      return { type: 'callout', attrs: { type, icon: m[2] ?? null, title: restoreText(m[3]!.trim()) }, content: body.length ? body : [{ type: 'paragraph' }] }
    }
  }
  const content = convertBlocks(children)
  return { type: 'blockquote', content: content.length ? content : [{ type: 'paragraph' }] }
}

function convertList(node: List): JSONContent {
  const isTask = node.children.some((li) => typeof li.checked === 'boolean')
  const items = node.children.map((li) => {
    const content = convertBlocks(li.children)
    const body = content.length ? content : [{ type: 'paragraph' }]
    return isTask ? { type: 'taskItem', attrs: { checked: li.checked === true }, content: body } : { type: 'listItem', content: body }
  })
  if (isTask) return { type: 'taskList', content: items }
  if (node.ordered) return { type: 'orderedList', attrs: { start: node.start ?? 1 }, content: items }
  return { type: 'bulletList', content: items }
}

function convertTable(node: Table): JSONContent {
  const align = node.align ?? []
  return {
    type: 'table',
    content: node.children.map((row, r) => ({
      type: 'tableRow',
      content: row.children.map((cell, c) => {
        const inline = convertInline(cell.children)
        return { type: r === 0 ? 'tableHeader' : 'tableCell', attrs: { align: align[c] ?? null }, content: [inline.length ? { type: 'paragraph', content: inline } : { type: 'paragraph' }] }
      })
    }))
  }
}

// --- satır içi ---

function convertInline(children: PhrasingContent[]): JSONContent[] {
  const out: JSONContent[] = []
  const htmlMarks: Mark[] = []
  walkInline(children, [], htmlMarks, out)
  return mergeText(out)
}

function walkInline(nodes: PhrasingContent[], marks: Mark[], htmlMarks: Mark[], out: JSONContent[]): void {
  for (const n of nodes) {
    switch (n.type) {
      case 'text':
        pushText(out, n.value.replace(/\n/g, ' '), [...marks, ...htmlMarks])
        break
      case 'strong':
        walkInline(n.children, [...marks, { type: 'bold' }], htmlMarks, out)
        break
      case 'emphasis':
        walkInline(n.children, [...marks, { type: 'italic' }], htmlMarks, out)
        break
      case 'delete':
        walkInline(n.children, [...marks, { type: 'strike' }], htmlMarks, out)
        break
      case 'link':
        walkInline(n.children, [...marks, { type: 'link', attrs: { href: n.url } }], htmlMarks, out)
        break
      case 'inlineCode':
        out.push(textNode(restoreRaw(n.value), [...marks, ...htmlMarks, { type: 'code' }]))
        break
      case 'inlineMath':
        out.push({ type: 'inlineMath', attrs: { latex: restoreRaw(n.value) } })
        break
      case 'break':
        out.push({ type: 'hardBreak' })
        break
      case 'html': {
        const h = parseInlineHtml(n.value)
        if (!h) {
          pushText(out, n.value, [...marks, ...htmlMarks])
        } else if (h.kind === 'break') {
          out.push({ type: 'hardBreak' })
        } else if (h.kind === 'open') {
          htmlMarks.push(h.mark === 'highlight' ? { type: 'highlight', attrs: { color: h.color } } : { type: 'underline' })
        } else {
          const idx = htmlMarks.map((m) => m.type).lastIndexOf(h.mark)
          if (idx >= 0) htmlMarks.splice(idx, 1)
        }
        break
      }
      case 'image':
        pushText(out, n.alt ?? '', [...marks, ...htmlMarks])
        break
      default:
        break
    }
  }
}

/** Metindeki ==vurgu== işaretlerini ayırır */
function pushText(out: JSONContent[], value: string, marks: Mark[]): void {
  if (!value) return
  const re = /==([^=\s](?:[^=]*[^=\s])?)==/g
  let last = 0
  for (let m = re.exec(value); m; m = re.exec(value)) {
    if (m.index > last) out.push(textNode(restoreText(value.slice(last, m.index)), marks))
    out.push(textNode(restoreText(m[1]!), [...marks, { type: 'highlight', attrs: { color: null } }]))
    last = m.index + m[0].length
  }
  if (last < value.length) out.push(textNode(restoreText(value.slice(last)), marks))
}

function textNode(text: string, marks: Mark[]): JSONContent {
  const sorted = normalizeMarks(marks)
  return sorted.length ? { type: 'text', text, marks: sorted } : { type: 'text', text }
}

function normalizeMarks(marks: Mark[]): Mark[] {
  const seen = new Map<string, Mark>()
  for (const m of marks) seen.set(m.type, m)
  return [...seen.values()].sort((a, b) => MARK_ORDER.indexOf(a.type as never) - MARK_ORDER.indexOf(b.type as never))
}

function mergeText(nodes: JSONContent[]): JSONContent[] {
  const out: JSONContent[] = []
  for (const n of nodes) {
    const prev = out[out.length - 1]
    if (n.type === 'text' && prev?.type === 'text' && JSON.stringify(prev.marks ?? []) === JSON.stringify(n.marks ?? [])) {
      prev.text = (prev.text ?? '') + (n.text ?? '')
    } else if (!(n.type === 'text' && !n.text)) {
      out.push(n)
    }
  }
  return out
}

export type { Nodes, Parents }
