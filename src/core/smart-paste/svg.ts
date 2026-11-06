import { toHtml } from 'hast-util-to-html'
import type { Element, ElementContent, Root as HastRoot } from 'hast'

// Yapıştırılan HTML'deki SVG grafikler (ör. Claude artifact) görsel dosyası olarak saklanmak üzere ayıklanır.
// Kayıttan önce temizlenir: script / foreignObject / on* olayları / dış bağlantılar atılır; tema değişkenleri sabit renge çevrilir.

const NEUTRAL = '#4a5560'
const DROP = new Set(['script', 'foreignObject', 'iframe', 'object', 'embed'])

/** var(--x, yedek) → yedek, var(--x) ve currentColor → nötr gri */
export function freezeColors(v: string): string {
  let s = v
  // iç içe var() için birkaç tur
  for (let i = 0; i < 4 && s.includes('var('); i++) s = s.replace(/var\(\s*--[\w-]+\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, fb: string | undefined) => (fb ? fb.trim() : NEUTRAL))
  return s.replace(/currentColor/gi, NEUTRAL)
}

function clean(el: Element): void {
  for (const key of Object.keys(el.properties ?? {})) {
    const v = el.properties[key]
    if (/^on/i.test(key)) delete el.properties[key]
    else if (/href$/i.test(key) && typeof v === 'string' && !v.startsWith('#')) delete el.properties[key]
    else if (typeof v === 'string') el.properties[key] = freezeColors(v)
  }
  el.children = el.children.flatMap((c): ElementContent[] => {
    if (c.type === 'element') {
      if (DROP.has(c.tagName)) return []
      clean(c)
    } else if (c.type === 'text') {
      // <style> içindeki tema değişkenleri
      return [{ ...c, value: freezeColors(c.value) }]
    }
    return [c]
  })
}

const dim = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : NaN)

/** Simge boyutundaki (≤ 24 px) SVG'ler grafik değildir */
function isIcon(el: Element): boolean {
  const w = dim(el.properties?.['width'])
  const h = dim(el.properties?.['height'])
  if (w <= 24 && h <= 24) return true
  const vb = String(el.properties?.['viewBox'] ?? '').split(/[\s,]+/).map(Number)
  return vb.length === 4 && vb[2]! <= 24 && vb[3]! <= 24
}

/** SVG öğelerini çıkarır, yerlerine placeholder(n) metni koyar; temizlenmiş SVG metinlerini döndürür */
export function extractSvgs(root: HastRoot | Element, placeholder: (n: number) => string, out: string[] = []): string[] {
  root.children = root.children.map((child): ElementContent => {
    if (child.type !== 'element') return child as ElementContent
    if (child.tagName === 'svg') {
      if (isIcon(child)) return { type: 'text', value: '' }
      clean(child)
      child.properties['xmlns'] = 'http://www.w3.org/2000/svg'
      // görselin doğal boyutu viewBox'tan
      const vb = String(child.properties['viewBox'] ?? '').split(/[\s,]+/).map(Number)
      if (vb.length === 4 && !(dim(child.properties['width']) > 0)) {
        child.properties['width'] = String(vb[2])
        child.properties['height'] = String(vb[3])
      }
      delete child.properties['className']
      out.push(toHtml(child, { space: 'svg' }))
      return { type: 'text', value: placeholder(out.length - 1) }
    }
    extractSvgs(child, placeholder, out)
    return child
  })
  return out
}
