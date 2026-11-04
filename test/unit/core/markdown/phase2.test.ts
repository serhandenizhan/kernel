import { describe, it, expect } from 'vitest'
import { markdownToDoc } from '@core/markdown/parse'
import { docToMarkdown } from '@core/markdown/serialize'
import { resolveWikiTarget } from '@core/wiki'
import type { TreeNode } from '@shared/types'

const docOf = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

describe('Faz 2 şeması', () => {
  const cases = [
    'bkz. [[Özdeğerler]] ve [[Lineer Cebir/Determinant|det]]',
    '![[attachments/slayt ş.pdf]]',
    '<details data-heading="2">\n<summary>Açılır başlık</summary>\n\niçerik\n\n</details>'
  ]
  for (const md of cases) {
    it(`round-trip: ${JSON.stringify(md.slice(0, 24))}`, () => {
      const once = docToMarkdown(markdownToDoc(md))
      expect(docToMarkdown(markdownToDoc(once))).toBe(once)
      expect(markdownToDoc(once)).toEqual(markdownToDoc(md))
    })
  }
  it('wiki link düğümü', () => {
    expect(markdownToDoc('[[A|b]]').content![0]).toEqual({ type: 'paragraph', content: [{ type: 'wikiLink', attrs: { target: 'A', label: 'b' } }] })
    expect(markdownToDoc('[[A]]').content![0]).toEqual({ type: 'paragraph', content: [{ type: 'wikiLink', attrs: { target: 'A', label: null } }] })
  })
  it('tek başına ![[x.pdf]] gömülü PDF olur, pdf olmayan metin kalır', () => {
    expect(markdownToDoc('![[attachments/x.pdf]]').content![0]).toEqual({ type: 'pdfEmbed', attrs: { src: 'attachments/x.pdf' } })
    expect(markdownToDoc('![[resim.png]]').content![0]!.type).toBe('paragraph')
  })
  it('başlıklı toggle seviyesini taşır', () => {
    expect(markdownToDoc('<details data-heading="3">\n<summary>S</summary>\n\nx\n\n</details>').content![0]!.attrs).toEqual({ card: false, heading: 3 })
    expect(markdownToDoc('<details>\n<summary>S</summary>\n\nx\n\n</details>').content![0]!.attrs).toEqual({ card: false, heading: null })
  })
  it('yazılan düz [[x]] metni wiki link olmaz', () => {
    const d = docOf('dizi [[1, 2]] ve [[x]]')
    expect(markdownToDoc(docToMarkdown(d))).toEqual(d)
  })
  it('başlığında [, ] ve | olan wiki link hedefleri kayıpsız döner', () => {
    for (const target of ['[Taslak] Plan', 'A | B', 'x]]y', 'ters\\eğik']) {
      const d = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'wikiLink', attrs: { target, label: target.includes('|') ? 'etiket [1]' : null } }] }] }
      expect(markdownToDoc(docToMarkdown(d))).toEqual(d)
    }
  })
  it('adında ] olan gömülü PDF kayıpsız döner', () => {
    const d = { type: 'doc', content: [{ type: 'pdfEmbed', attrs: { src: 'attachments/slayt [v2]].pdf' } }] }
    expect(markdownToDoc(docToMarkdown(d))).toEqual(d)
  })
  it('tablo hücresindeki kaçışlı | korunur', () => {
    expect(JSON.stringify(markdownToDoc('| a |\n| --- |\n| x \\| y |'))).toContain('x | y')
  })
  it('kod içindeki [[x]] dokunulmaz', () => {
    expect(markdownToDoc('`[[x]]`').content![0]).toEqual({ type: 'paragraph', content: [{ type: 'text', text: '[[x]]', marks: [{ type: 'code' }] }] })
  })
})

describe('resolveWikiTarget', () => {
  const tree: TreeNode[] = [
    { id: 'L', title: 'Lineer Cebir', path: 'Lineer Cebir.md', children: [{ id: 'D', title: 'Determinant', path: 'Lineer Cebir/Determinant.md', children: [] }] },
    { id: 'O', title: 'Özdeğerler', path: 'Özdeğerler.md', children: [] }
  ]
  it('başlığa büyük/küçük harf duyarsız, yola göre ve bulunamayınca null', () => {
    expect(resolveWikiTarget(tree, 'özdeğerler')).toBe('O')
    expect(resolveWikiTarget(tree, 'ÖZDEĞERLER')).toBe('O')
    expect(resolveWikiTarget(tree, 'Lineer Cebir/Determinant')).toBe('D')
    expect(resolveWikiTarget(tree, 'Determinant')).toBe('D')
    expect(resolveWikiTarget(tree, 'yok')).toBeNull()
  })
})
