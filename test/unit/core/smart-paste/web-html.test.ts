import { describe, it, expect } from 'vitest'
import { convertPaste } from '@core/smart-paste'

const opts = { stripCitations: true, latexLineHeuristic: true, unfencedCodeHeuristic: true }

describe('web sayfasından yapıştırma', () => {
  it('keeps headings, lists, bold, italic and links from rich HTML', () => {
    const html = '<h2>Yapıştırılan</h2><p>Bir <b>kalın</b>, <em>eğik</em> ve <a href="https://ornek.com">link</a></p><ul><li>bir</li><li>iki</li></ul>'
    const text = 'Yapıştırılan\nBir kalın, eğik ve link\nbir\niki'
    const { markdown } = convertPaste({ text, html }, opts)
    expect(markdown).toContain('## Yapıştırılan')
    expect(markdown).toContain('**kalın**')
    expect(markdown).toContain('*eğik*')
    expect(markdown).toContain('[link](https://ornek.com)')
    expect(markdown).toMatch(/- bir\n- iki/)
  })

  it('keeps tables', () => {
    const html = '<table><tr><th>Ad</th><th>Not</th></tr><tr><td>Ali</td><td>90</td></tr></table>'
    expect(convertPaste({ text: 'Ad Not\nAli 90', html }, opts).markdown).toMatch(/\| Ad +\| Not +\|/)
  })

  it('still uses plain text for plain HTML wrappers (AI markdown keeps working)', () => {
    const { markdown } = convertPaste({ text: '## Başlık\n\n$x^2$ formül', html: '<meta charset="utf-8"><span>## Başlık</span><br><span>$x^2$ formül</span>' }, opts)
    expect(markdown).toContain('## Başlık')
    expect(markdown).toContain('$x^2$')
  })
})

describe('HTML içindeki ham LaTeX', () => {
  it('keeps \\( \\) and \\[ \\] formulas intact when HTML has formatting', () => {
    const html = '<p>Özdeğer <b>tanımı</b>: \\(A v = \\lambda v\\) ve</p><p>\\[\\det(A-\\lambda I)=0\\]</p><p>Ayrıca $x_1^2$ ve <i>son</i></p>'
    const { markdown } = convertPaste({ text: '', html }, opts)
    expect(markdown).toContain('$A v = \\lambda v$')
    expect(markdown).toContain('$$\n\\det(A-\\lambda I)=0\n$$')
    expect(markdown).toContain('$x_1^2$')
    expect(markdown).not.toContain('\\$')
  })
})
