import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { toText } from 'hast-util-to-text'
import type { Element, Root as HastRoot, ElementContent } from 'hast'
import { isArtifactHtml, rewriteArtifact, type CalloutItem } from './artifact'

// formül / kod ya da web sayfası biçimi (başlık, liste, tablo, alıntı, kalın, eğik, link) varsa HTML kullanılır; düz sarmalayıcıda düz metin
const STRUCTURED = /application\/x-tex|math\/tex|<pre[\s>]|class="[^"]*\bkatex\b|<(h[1-6]|ul|ol|table|blockquote|strong|b|em|i|a)[\s>]/i
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

// metin içinde yazılmış ham LaTeX: \[…\], $$…$$ (blok), \(…\), $…$ (satır içi)
const RAW_MATH = /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g

/** Metin düğümlerindeki ham LaTeX'i yer tutucuya çevirir (Markdown'a dönüşürken \ ve $ kaçışlanıp bozulmasın); kod içine dokunmaz */
function rewriteRawMath(node: HastRoot | Element, items: MathItem[]): void {
  node.children = node.children.map((child): ElementContent => {
    if (child.type === 'element') {
      if (child.tagName !== 'code' && child.tagName !== 'pre') rewriteRawMath(child, items)
      return child
    }
    if (child.type !== 'text' || !RAW_MATH.test(child.value)) return child as ElementContent
    RAW_MATH.lastIndex = 0
    const value = child.value.replace(RAW_MATH, (_m, d1: string, d2: string, i1: string, i2: string) => {
      const display = d1 !== undefined || d2 !== undefined
      items.push({ latex: (d1 ?? d2 ?? i1 ?? i2)!.trim(), display })
      return placeholder(items.length - 1)
    })
    return { ...child, value }
  })
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

interface MdNode {
  type: string
  spread?: boolean
  children?: MdNode[]
}
function tighten(n: MdNode): void {
  if (n.type === 'list' || n.type === 'listItem') n.spread = false
  n.children?.forEach(tighten)
}

// Zengin panodan gelen HTML'i Markdown'a çevirir; yapılandırılmış içerik (formül/kod) yoksa null
export function htmlToMarkdown(html: string): string | null {
  const artifact = isArtifactHtml(html)
  if (!STRUCTURED.test(html) && !artifact) return null
  const hast = unified().use(rehypeParse, { fragment: true }).parse(html)
  const items: MathItem[] = []
  rewriteMath(hast, items)
  rewriteRawMath(hast, items)
  const callouts: CalloutItem[] = []
  if (artifact) rewriteArtifact(hast, callouts)
  const mdast = unified().use(rehypeRemark).runSync(hast)
  // artifact listeleri sıkı (aralarında boş satır olmadan) yazılır
  if (artifact) tighten(mdast as unknown as MdNode)
  const md = unified().use(remarkGfm).use(remarkStringify, { bullet: '-', fences: true, emphasis: '*', strong: '*' }).stringify(mdast as never)
  return md
    .replace(/KERNELMATH(\d+)X/g, (_, n: string) => {
      const item = items[Number(n)]!
      return item.display ? `\n\n$$\n${item.latex}\n$$\n\n` : `$${item.latex}$`
    })
    .replace(/KERNELCALLOUT(\d+)X/g, (_, n: string) => {
      const c = callouts[Number(n)]!
      return `[!${c.type}]${c.title ? ` ${c.title}` : ''}`
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
