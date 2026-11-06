import { describe, it, expect } from 'vitest'
import { convertPaste } from '@core/smart-paste'

const opts = { stripCitations: true, latexLineHeuristic: true, unfencedCodeHeuristic: true }

describe('yapıştırılan HTML içindeki SVG grafikler', () => {
  const html =
    '<p>Önce</p><svg viewBox="0 0 400 200" class="chart"><script>alert(1)</script><rect onclick="x()" fill="var(--c, #ff0000)" width="5" height="5"/><text fill="currentColor" style="fill: var(--text-1)">A</text><a href="https://kotu.example"><circle r="1"/></a><foreignObject><div>x</div></foreignObject></svg><p>Sonra</p>'

  it('replaces each svg with an image placeholder in place', () => {
    const r = convertPaste({ text: 'Önce Sonra', html }, opts)
    expect(r.svgs).toHaveLength(1)
    expect(r.markdown).toMatch(/Önce\n\n!\[\]\(kernel-svg:0\)\n\nSonra/)
  })

  it('sanitizes the svg and freezes theme colors', () => {
    const svg = convertPaste({ text: '', html }, opts).svgs[0]!
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).not.toMatch(/script|onclick|foreignObject|kotu\.example/i)
    expect(svg).toContain('fill="#ff0000"')
    expect(svg).not.toContain('currentColor')
    expect(svg).not.toContain('var(')
    expect(svg).toContain('<circle')
  })

  it('ignores tiny icon svgs', () => {
    const r = convertPaste({ text: 'a', html: '<p>a <svg width="12" height="12" viewBox="0 0 12 12"><path d="M0 0h1"/></svg></p><ul><li>b</li></ul>' }, opts)
    expect(r.svgs).toHaveLength(0)
  })
})
