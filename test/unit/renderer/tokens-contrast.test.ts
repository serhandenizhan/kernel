import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync('src/renderer/styles/tokens.css', 'utf8')
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`)
  return css.slice(start, css.indexOf('\n}', start))
}
const token = (b: string, name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(b)
  if (!m) throw new Error(`${name} bulunamadı`)
  return m[1]!
}
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

describe('metin kontrastı (WCAG AA, yazı alanı degradesinin iki ucunda)', () => {
  for (const [name, sel] of [['açık', ':root'], ['koyu', ":root[data-theme='dark']"]] as const) {
    it(`${name} tema`, () => {
      const b = block(sel)
      for (const paper of ['paper-top', 'paper-bottom']) {
        for (const text of ['text', 'text-2', 'text-3']) {
          expect(contrast(token(b, text), token(b, paper)), `${text} / ${paper}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    })
  }
})

describe('kod blokları sayfadan ayrışır', () => {
  const blocks = readFileSync('src/renderer/styles/blocks.css', 'utf8')
  it('açık temada kod zemini yazı alanının üst ucundan belirgin biçimde koyudur', () => {
    const b = block(':root')
    expect(contrast(token(b, 'code-bg'), token(b, 'paper-top'))).toBeGreaterThanOrEqual(1.12)
  })
  it('her iki temada kod bloğunun bir kenar çizgisi vardır (degradenin alt ucunda da seçilsin)', () => {
    expect(block(':root')).toMatch(/--code-border:/)
    expect(block(":root[data-theme='dark']")).toMatch(/--code-border:/)
    const rule = blocks.slice(blocks.indexOf('.code-block {'), blocks.indexOf('}', blocks.indexOf('.code-block {')))
    expect(rule).toMatch(/border:\s*1px solid var\(--code-border\)/)
  })
})
