import { describe, it, expect } from 'vitest'
import { markdownToDoc } from '@core/markdown/parse'

const t = (text: string, marks?: unknown[]) => (marks ? { type: 'text', text, marks } : { type: 'text', text })
const p = (...content: unknown[]) => (content.length ? { type: 'paragraph', content } : { type: 'paragraph' })
const doc = (...content: unknown[]) => ({ type: 'doc', content })

describe('markdownToDoc — bloklar', () => {
  it('boş metin tek boş paragraf verir', () => {
    expect(markdownToDoc('')).toEqual(doc(p()))
  })
  it('başlık seviyeleri 1–6', () => {
    expect(markdownToDoc('# A\n\n###### F')).toEqual(
      doc({ type: 'heading', attrs: { level: 1 }, content: [t('A')] }, { type: 'heading', attrs: { level: 6 }, content: [t('F')] })
    )
  })
  it('paragraf içindeki yumuşak satır sonu boşluk olur', () => {
    expect(markdownToDoc('bir\niki')).toEqual(doc(p(t('bir iki'))))
  })
  it('iç içe listeler', () => {
    expect(markdownToDoc('- a\n  - b\n\n3. x')).toEqual(
      doc(
        { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('a')), { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('b'))] }] }] }] },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p(t('x'))] }] }
      )
    )
  })
  it('yapılacaklar listesi', () => {
    expect(markdownToDoc('- [ ] yap\n- [x] bitti')).toEqual(
      doc({
        type: 'taskList',
        content: [
          { type: 'taskItem', attrs: { checked: false }, content: [p(t('yap'))] },
          { type: 'taskItem', attrs: { checked: true }, content: [p(t('bitti'))] }
        ]
      })
    )
  })
  it('callout: tür, ikon, başlık ve gövde', () => {
    expect(markdownToDoc('> [!warning|⚠️] Dikkat\n> içerik')).toEqual(
      doc({ type: 'callout', attrs: { type: 'warning', icon: '⚠️', title: 'Dikkat' }, content: [p(t('içerik'))] })
    )
  })
  it('bilinmeyen callout türü note olur, gövdesiz callout boş paragraf alır', () => {
    expect(markdownToDoc('> [!acaip]')).toEqual(doc({ type: 'callout', attrs: { type: 'note', icon: null, title: '' }, content: [p()] }))
  })
  it('düz alıntı', () => {
    expect(markdownToDoc('> söz')).toEqual(doc({ type: 'blockquote', content: [p(t('söz'))] }))
  })
  it('toggle (details) ve kart işareti', () => {
    expect(markdownToDoc('<details data-card>\n<summary>Soru **kalın**</summary>\n\nCevap\n\n</details>')).toEqual(
      doc({
        type: 'details',
        attrs: { card: true, heading: null },
        content: [
          { type: 'detailsSummary', content: [t('Soru '), t('kalın', [{ type: 'bold' }])] },
          { type: 'detailsContent', content: [p(t('Cevap'))] }
        ]
      })
    )
  })
  it('kod bloğu dil ve satır numarası', () => {
    expect(markdownToDoc('```python {lineNumbers}\nprint(1)\n```')).toEqual(
      doc({ type: 'codeBlock', attrs: { language: 'python', lineNumbers: true }, content: [t('print(1)')] })
    )
    expect(markdownToDoc('```\n```')).toEqual(doc({ type: 'codeBlock', attrs: { language: null, lineNumbers: false } }))
  })
  it('blok ve satır içi formül', () => {
    expect(markdownToDoc('$$\n\\frac{a}{b}\n$$\n\nmetin $x^2$ son')).toEqual(
      doc({ type: 'blockMath', attrs: { latex: '\\frac{a}{b}' } }, p(t('metin '), { type: 'inlineMath', attrs: { latex: 'x^2' } }, t(' son')))
    )
  })
  it('görsel: genişlik ve alt yazı', () => {
    expect(markdownToDoc('![ş|600](<attachments/a b.png>)\n*alt yazı*')).toEqual(
      doc({ type: 'image', attrs: { src: 'attachments/a b.png', alt: 'ş', width: 600, caption: 'alt yazı' } })
    )
  })
  it('tablo hizalamasıyla', () => {
    expect(markdownToDoc('| a | b |\n| :-- | --: |\n| 1 | 2 |')).toEqual(
      doc({
        type: 'table',
        content: [
          { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { align: 'left' }, content: [p(t('a'))] }, { type: 'tableHeader', attrs: { align: 'right' }, content: [p(t('b'))] }] },
          { type: 'tableRow', content: [{ type: 'tableCell', attrs: { align: 'left' }, content: [p(t('1'))] }, { type: 'tableCell', attrs: { align: 'right' }, content: [p(t('2'))] }] }
        ]
      })
    )
  })
  it('ikili (NUL içeren) dosyayı reddeder', () => {
    expect(() => markdownToDoc('abc\u0000def')).toThrow('ikili')
  })
  it('ayırıcı', () => {
    expect(markdownToDoc('a\n\n---\n\nb')).toEqual(doc(p(t('a')), { type: 'horizontalRule' }, p(t('b'))))
  })
})
