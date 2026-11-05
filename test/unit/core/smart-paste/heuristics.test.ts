import { describe, it, expect } from 'vitest'
import { normalizeLanguage, detectLanguage } from '@core/smart-paste/language'
import { stripCitations } from '@core/smart-paste/citations'
import { latexLineScore } from '@core/smart-paste/latex-line'
import { detectUnfencedCode } from '@core/smart-paste/code-detect'
import { htmlToMarkdown } from '@core/smart-paste/html'

describe('normalizeLanguage', () => {
  it('kısaltmaları normalize eder', () => {
    expect(normalizeLanguage('py')).toBe('python')
    expect(normalizeLanguage('c++')).toBe('cpp')
    expect(normalizeLanguage('JS')).toBe('javascript')
    expect(normalizeLanguage('md')).toBe('markdown')
    expect(normalizeLanguage('zsh')).toBe('bash')
  })
  it('düz metin etiketleri dilsizdir', () => {
    expect(normalizeLanguage('text')).toBe(null)
    expect(normalizeLanguage('plaintext')).toBe(null)
    expect(normalizeLanguage(null)).toBe(null)
  })
  it('bilinmeyen etiketi küçük harfle korur', () => {
    expect(normalizeLanguage('Mermaid')).toBe('mermaid')
  })
})

describe('detectLanguage', () => {
  it('C kodunu tanır', () => {
    expect(detectLanguage('#include <stdio.h>\nint main(void) {\n  printf("x");\n  return 0;\n}')).toBe('c')
  })
  it('SQL ve Python kodunu tanır', () => {
    expect(detectLanguage('SELECT name, email FROM users WHERE id = 1 ORDER BY name;')).toBe('sql')
    expect(detectLanguage('def topla(a, b):\n    return a + b\n\nprint(topla(1, 2))')).toBe('python')
  })
  it('düz metinde dil uydurmaz', () => {
    expect(detectLanguage('Bugün hava güzel.')).toBe(null)
  })
})

describe('stripCitations', () => {
  it('bitişik sayısal kaynak numaralarını siler, diğer köşeli parantezleri korur', () => {
    expect(stripCitations('Model iyidir.[1] Ayrıca[2, 3] ve [CLS] ile [0, 1] ve x[4-6].')).toBe('Model iyidir. Ayrıca ve [CLS] ile [0, 1] ve x.')
  })
})

describe('latexLineScore', () => {
  it('saf LaTeX satırına yüksek puan verir', () => {
    expect(latexLineScore('\\frac{\\partial L}{\\partial w} = \\sum_{i=1}^{n} x_i')).toBeGreaterThanOrEqual(0.75)
  })
  it('düzyazıya düşük puan verir', () => {
    expect(latexLineScore('Bu cümle sadece düz bir açıklamadır.')).toBeLessThan(0.4)
    expect(latexLineScore('Kayıp fonksiyonu \\sum_i (y_i - \\hat{y}_i)^2 olarak tanımlanır ve minimize edilir')).toBeLessThan(0.75)
  })
})

describe('detectUnfencedCode', () => {
  it('kod satır grubunu çite alır, düzyazıya dokunmaz', () => {
    const src = 'Örnek:\n\nint x = 1;\nreturn x;\n\nSon cümle burada bitiyor.'
    expect(detectUnfencedCode(src)).toBe('Örnek:\n\n```\nint x = 1;\nreturn x;\n```\n\nSon cümle burada bitiyor.')
  })
  it('liste ve tablo satırlarını kod sanmaz', () => {
    const src = '- a = 1 ise;\n- b = 2 ise;\n\n| a | b |\n| --- | --- |'
    expect(detectUnfencedCode(src)).toBe(src)
  })
})

describe('htmlToMarkdown', () => {
  it('yapılandırılmış içerik yoksa null döner', () => {
    expect(htmlToMarkdown('<p>sadece metin</p><span>ve satır</span>')).toBe(null)
  })
  it('KaTeX annotation ve dil sınıflı kodu çıkarır', () => {
    const md = htmlToMarkdown('<p>a <span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span><span class="katex-html">x2</span></span></p><pre><code class="language-js">let a</code></pre>')
    expect(md).toContain('$x^2$')
    expect(md).toContain('```js')
    expect(md).not.toContain('x2')
  })
})
