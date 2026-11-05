import { toText } from 'hast-util-to-text'
import type { Element, ElementContent, Root as HastRoot } from 'hast'
import type { CalloutType } from '../markdown/schema'

// Claude artifact'ları gibi "kart + sınıf adı" ile kurulmuş HTML sayfalarını düzenlenebilir
// Markdown yapılarına hazırlar (rehype-remark öncesi hast dönüşümü).

const MARKER = /<(dl|section|aside)[\s>]|class="[^"]*\b(card|warn|callout|timeline|formula|flow|branch)/i

/** Yapıştırılan HTML artifact benzeri mi (terim listesi, bölüm kartları, sınıflı kutular) */
export function isArtifactHtml(html: string): boolean {
  return MARKER.test(html)
}

export const calloutPlaceholder = (n: number) => `KERNELCALLOUT${n}X`

export interface CalloutItem {
  type: CalloutType
  title: string
}

const DROP = new Set(['style', 'script', 'link', 'meta', 'title', 'head', 'noscript', 'template'])
const BLOCK_TAGS = new Set(['div', 'section', 'aside', 'article'])

const classes = (el: Element): string[] => {
  const c = el.properties?.['className']
  return Array.isArray(c) ? c.map((x) => String(x).toLowerCase()) : []
}
const hasPrefix = (el: Element, re: RegExp) => classes(el).some((c) => re.test(c))
const elementChildren = (el: Element) => el.children.filter((c): c is Element => c.type === 'element')
const h = (tagName: string, children: ElementContent[] = []): Element => ({ type: 'element', tagName, properties: {}, children })
const text = (value: string): ElementContent => ({ type: 'text', value })

function calloutType(el: Element): CalloutType | null {
  if (el.tagName === 'aside') return 'note'
  if (!BLOCK_TAGS.has(el.tagName)) return null
  for (const c of classes(el)) {
    if (/^(warn|caution|alert)/.test(c)) return 'warning'
    if (/^danger/.test(c)) return 'danger'
    if (/^tip/.test(c)) return 'tip'
    if (/^info/.test(c)) return 'info'
    if (/^(note|callout|admonition)/.test(c)) return 'note'
  }
  return null
}

/** "<b>ETİKET</b>metin" kutusunu "**ETİKET:** metin" madde öğesine çevirir */
function labeledItem(el: Element): Element {
  const first = el.children.find((c) => c.type === 'element' || (c.type === 'text' && c.value.trim()))
  if (first?.type === 'element' && (first.tagName === 'b' || first.tagName === 'strong')) {
    const rest = el.children.slice(el.children.indexOf(first) + 1)
    return h('li', [h('strong', [text(`${toText(first).trim()}:`)]), text(' '), ...rest])
  }
  return h('li', el.children)
}

function dlToList(dl: Element): Element {
  const items: Element[] = []
  let current: Element | null = null
  for (const c of elementChildren(dl)) {
    // <div><dt/><dd/></div> sarmalayıcıları da desteklenir
    const parts = c.tagName === 'div' ? elementChildren(c) : [c]
    for (const p of parts) {
      if (p.tagName === 'dt') {
        current = h('li', [h('strong', [text(`${toText(p).trim()}:`)])])
        items.push(current)
      } else if (p.tagName === 'dd') {
        if (!current) {
          current = h('li', [])
          items.push(current)
        }
        current.children.push(text(current.children.length > 1 ? '; ' : ' '), ...p.children)
      }
    }
  }
  return h('ul', items)
}

function timelineToList(el: Element): Element {
  const kids = elementChildren(el)
  const items: Element[] = []
  for (let i = 0; i + 1 < kids.length; i += 2) items.push(h('li', [h('strong', [text(`${toText(kids[i]!).trim()}:`)]), text(' '), ...kids[i + 1]!.children]))
  if (kids.length % 2) items.push(h('li', kids[kids.length - 1]!.children))
  return h('ul', items)
}

function formulaToCode(el: Element): Element {
  const lines = toText(el)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return h('pre', [h('code', [text(lines.join('\n'))])])
}

function flowToList(el: Element): Element {
  const items: Element[] = []
  for (const c of elementChildren(el)) {
    if (hasPrefix(c, /^branches/)) {
      const nested = h('ul', elementChildren(c).map(labeledItem))
      if (items.length) items[items.length - 1]!.children.push(nested)
      else items.push(h('li', [nested]))
    } else items.push(labeledItem(c))
  }
  return h('ul', items)
}

/** Artifact yapıları: terim listesi, zaman çizelgesi, formül kutusu, karar akışı, etiketli kutular, uyarı kutusu */
export function rewriteArtifact(node: HastRoot | Element, callouts: CalloutItem[]): void {
  const out: ElementContent[] = []
  for (const child of node.children) {
    if (child.type !== 'element') {
      if (child.type !== 'comment' && child.type !== 'doctype') out.push(child as ElementContent)
      continue
    }
    if (DROP.has(child.tagName)) continue
    if (child.tagName === 'dl') {
      out.push(dlToList(child))
      continue
    }
    if (hasPrefix(child, /^timeline/)) {
      out.push(timelineToList(child))
      continue
    }
    if (hasPrefix(child, /^(formula|equation)/) && child.tagName !== 'span') {
      out.push(formulaToCode(child))
      continue
    }
    if (hasPrefix(child, /^(flow|steps|decision)/)) {
      out.push(flowToList(child))
      continue
    }
    const kids = elementChildren(child)
    if (kids.length && kids.every((k) => hasPrefix(k, /^branch$/))) {
      out.push(h('ul', kids.map(labeledItem)))
      continue
    }
    const type = calloutType(child)
    if (type) {
      const heading = kids.find((k) => /^h[1-6]$/.test(k.tagName))
      callouts.push({ type, title: heading ? toText(heading).trim() : '' })
      const body = h('div', child.children.filter((c) => c !== heading))
      rewriteArtifact(body, callouts)
      out.push(h('blockquote', [h('p', [text(calloutPlaceholder(callouts.length - 1))]), ...body.children]))
      continue
    }
    rewriteArtifact(child, callouts)
    out.push(child)
  }
  node.children = out as typeof node.children
}
