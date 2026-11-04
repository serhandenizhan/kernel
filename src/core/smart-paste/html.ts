import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { toText } from 'hast-util-to-text'
import type { Element, Root as HastRoot, ElementContent } from 'hast'

const STRUCTURED = /application\/x-tex|math\/tex|<pre[\s>]|class="[^"]*\bkatex\b/i
const placeholder = (n: number) => `KERNELMATH${n}X`

const hasClass = (el: Element, name: string) => {
  const cls = el.properties?.['className']
  return Array.isArray(cls) && cls.map(String).includes(name)
}

function findAnnotation(el: Element): string | null {
  for (const child of el.children) {
    if (child.type !== 'element') continue
    if (child.tagName === 'annotation' && String(child.properties?.['encoding'] ?? '') === 'application/x-tex') return toText(child)
    const found = findAnnotation(child)
    if (found !== null) return found
  }
  return null
}

function isDisplay(el: Element, ancestors: Element[]): boolean {
  return [el, ...ancestors].some((a) => hasClass(a, 'katex-display') || hasClass(a, 'math-display') || a.properties?.['display'] === 'block')
}

interface MathItem {
  latex: string
  display: boolean
}

/** KaTeX / MathJax işaretlemesini metin yer tutucularıyla değiştirir (etraftaki boşluklar korunur) */
function rewriteMath(node: HastRoot | Element, items: MathItem[], ancestors: Element[] = []): void {
  node.children = node.children.map((child): ElementContent => {
    if (child.type !== 'element') return child as ElementContent
    const isKatex = hasClass(child, 'katex')
    const isScript = child.tagName === 'script' && /math\/tex/.test(String(child.properties?.['type'] ?? ''))
    if (isKatex || isScript) {
      const latex = isScript ? toText(child) : findAnnotation(child)
      if (latex !== null) {
        const display = isScript ? /mode=display/.test(String(child.properties?.['type'])) : isDisplay(child, ancestors)
        items.push({ latex: latex.trim(), display })
        return { type: 'text', value: placeholder(items.length - 1) }
      }
    }
    rewriteMath(child, items, [child, ...ancestors])
    return child
  }) as typeof node.children
}

// Zengin panodan gelen HTML'i Markdown'a çevirir; yapılandırılmış içerik (formül/kod) yoksa null
export function htmlToMarkdown(html: string): string | null {
  if (!STRUCTURED.test(html)) return null
  const hast = unified().use(rehypeParse, { fragment: true }).parse(html)
  const items: MathItem[] = []
  rewriteMath(hast, items)
  const mdast = unified().use(rehypeRemark).runSync(hast)
  const md = unified().use(remarkGfm).use(remarkStringify, { bullet: '-', fences: true, emphasis: '*', strong: '*' }).stringify(mdast as never)
  return md
    .replace(/KERNELMATH(\d+)X/g, (_, n: string) => {
      const item = items[Number(n)]!
      return item.display ? `\n\n$$\n${item.latex}\n$$\n\n` : `$${item.latex}$`
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
