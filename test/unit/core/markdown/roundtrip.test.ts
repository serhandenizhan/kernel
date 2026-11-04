import { describe, it, expect } from 'vitest'
import { markdownToDoc } from '@core/markdown/parse'
import { docToMarkdown } from '@core/markdown/serialize'

const cases = [
  '# H1\n\n###### H6',
  '- a\n  - b\n\n1. x\n2. y',
  '- [ ] yap\n- [x] bitti',
  '> [!warning|⚠️] Dikkat\n> içerik',
  '> [!note]\n> a\n>\n> b',
  '> düz alıntı',
  '<details>\n<summary>Başlık</summary>\n\niçerik **kalın**\n\n- liste\n\n</details>',
  '<details>\n<summary>Dış</summary>\n\n<details>\n<summary>İç</summary>\n\nx\n\n</details>\n\n</details>',
  '```python\nprint(1)\n```',
  '```js {lineNumbers}\nlet a = 1\n```',
  '$$\n\\frac{a}{b}\n$$',
  'metin $x^2$ metin',
  '![ş|600](<attachments/a b.png>)\n*alt yazı*',
  '![logo](attachments/logo.png)',
  '| a | b |\n| :-- | --: |\n| 1 | 2 |',
  'a <u>alt</u> <mark data-color="yellow">sarı</mark> ==düz== ~~çizik~~ [link](https://x.y)',
  '**kalın *iç içe* devam** ve `kod`',
  'a\n\n---\n\nb',
  'satır  \nsonu'
]

describe('round-trip', () => {
  for (const md of cases) {
    it(`kayıpsız: ${JSON.stringify(md.slice(0, 30))}`, () => {
      const once = docToMarkdown(markdownToDoc(md))
      expect(docToMarkdown(markdownToDoc(once))).toBe(once)
      expect(markdownToDoc(once)).toEqual(markdownToDoc(md))
    })
  }

  const docOf = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })
  it('düz metindeki $ formüle dönüşmez', () => {
    expect(markdownToDoc(docToMarkdown(docOf('5$ ile 10$ arası')))).toEqual(docOf('5$ ile 10$ arası'))
  })
  it('düz metindeki a == b vurguya dönüşmez', () => {
    expect(markdownToDoc(docToMarkdown(docOf('a == b ve x==y==z')))).toEqual(docOf('a == b ve x==y==z'))
  })
  it('özel karakterli düz metin korunur', () => {
    const s = '# değil * yıldız _alt_ [köşeli] <etiket> \\ ters `tik`'
    expect(markdownToDoc(docToMarkdown(docOf(s)))).toEqual(docOf(s))
  })
  it('dosya sonu tek satır sonu', () => {
    expect(docToMarkdown(markdownToDoc('a'))).toBe('a\n')
  })
})
