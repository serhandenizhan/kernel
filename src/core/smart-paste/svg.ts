import { toHtml } from 'hast-util-to-html'
import type { Element, ElementContent, Root as HastRoot } from 'hast'

// Yapıştırılan HTML'deki SVG grafikler (ör. Claude artifact) görsel dosyası olarak saklanmak üzere ayıklanır.
// İzin listesiyle temizlenir: yalnızca çizim öğeleri kalır; olaylar, animasyonlar, dış bağlantılar ve dış url() atılır;
// tema değişkenleri sabit renge çevrilir.

const NEUTRAL = '#4a5560'
const ALLOWED = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
  'marker',
  'symbol',
  'use',
  'title',
  'desc',
  'style'
])
/** url(#id) dışındaki url(...) ve @import */
const EXTERNAL_URL = /url\(\s*(['"]?)(?!#)[^)]*\1\s*\)|@import[^;]*;?/gi

/** var(--x, yedek) → yedek, var(--x) ve currentColor → nötr gri */
export function freezeColors(v: string): string {
  let s = v
  // iç içe var() için birkaç tur
  for (let i = 0; i < 4 && s.includes('var('); i++) s = s.replace(/var\(\s*--[\w-]+\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, fb: string | undefined) => (fb ? fb.trim() : NEUTRAL))
  return s.replace(/currentColor/gi, NEUTRAL)
}

const cleanValue = (v: string) => freezeColors(v).replace(EXTERNAL_URL, 'none')

function clean(el: Element): boolean {
  let xlink = false
  for (const key of Object.keys(el.properties ?? {})) {
    const v = el.properties[key]
    if (/^on/i.test(key)) delete el.properties[key]
    else if (/href$/i.test(key)) {
      // yalnızca belge içi başvuru (#id)
      if (typeof v !== 'string' || !v.startsWith('#')) delete el.properties[key]
      else if (key !== 'href') xlink = true
    } else if (typeof v === 'string') el.properties[key] = cleanValue(v)
  }
  el.children = el.children.flatMap((c): ElementContent[] => {
    if (c.type === 'element') {
      // bağlantı açılır, içindeki çizim kalır
      if (c.tagName === 'a') {
        const box: Element = { ...c, properties: {} }
        if (clean(box)) xlink = true
        return box.children
      }
      if (!ALLOWED.has(c.tagName)) return []
      if (clean(c)) xlink = true
      return [c]
    }
    // <style> ve metin içindeki tema değişkenleri / dış url
    if (c.type === 'text') return [{ ...c, value: cleanValue(c.value) }]
    return []
  })
  return xlink
}

const dim = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : NaN)

/** Grafik sayılmayanlar: simge boyutunda (< 48 px) ya da boyut bilgisi olmayan (süs / logo) SVG'ler */
function isDecoration(el: Element): boolean {
  const vb = String(el.properties?.['viewBox'] ?? '')
    .split(/[\s,]+/)
    .map(Number)
  const w = dim(el.properties?.['width'])
  const h = dim(el.properties?.['height'])
  const hasVb = vb.length === 4 && vb.every(Number.isFinite)
  const width = Number.isFinite(w) ? w : hasVb ? vb[2]! : NaN
  const height = Number.isFinite(h) ? h : hasVb ? vb[3]! : NaN
  if (!Number.isFinite(width) || !Number.isFinite(height)) return true
  return width < 48 && height < 48
}

/** SVG öğelerini çıkarır, yerlerine placeholder(n) metni koyar; temizlenmiş SVG metinlerini döndürür */
export function extractSvgs(root: HastRoot | Element, placeholder: (n: number) => string, out: string[] = []): string[] {
  root.children = root.children.map((child): ElementContent => {
    if (child.type !== 'element') return child as ElementContent
    if (child.tagName === 'svg') {
      if (isDecoration(child)) return { type: 'text', value: '' }
      const xlink = clean(child)
      child.properties['xmlns'] = 'http://www.w3.org/2000/svg'
      if (xlink) child.properties['xmlnsXLink'] = 'http://www.w3.org/1999/xlink'
      // görselin doğal boyutu viewBox'tan
      const vb = String(child.properties['viewBox'] ?? '')
        .split(/[\s,]+/)
        .map(Number)
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
