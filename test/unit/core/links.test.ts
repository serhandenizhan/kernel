import { describe, expect, it } from 'vitest'
import { extractLinks, extractTags, renameLinks } from '@core/links'

describe('extractLinks', () => {
  it('finds targets, labels and the surrounding line', () => {
    const md = 'Giriş satırı\n\nBkz. [[Özdeğerler]] ve [[Cebir/Matris|matrisler]] konusu.\n'
    expect(extractLinks(md)).toEqual([
      { target: 'Özdeğerler', label: null, line: 'Bkz. Özdeğerler ve matrisler konusu.' },
      { target: 'Cebir/Matris', label: 'matrisler', line: 'Bkz. Özdeğerler ve matrisler konusu.' }
    ])
  })

  it('ignores links inside fenced and inline code', () => {
    const md = '```\n[[Kod içi]]\n```\n\n`[[satır içi]]` ve [[Gerçek]]'
    expect(extractLinks(md).map((l) => l.target)).toEqual(['Gerçek'])
  })

  it('skips embeds and truncates very long context lines', () => {
    const long = 'a'.repeat(400)
    const md = `![[attachments/x.pdf]]\n${long} [[Hedef]] ${long}`
    const links = extractLinks(md)
    expect(links.map((l) => l.target)).toEqual(['Hedef'])
    expect(links[0]!.line.length).toBeLessThanOrEqual(241)
    expect(links[0]!.line).toContain('Hedef')
  })
})

describe('extractTags', () => {
  it('merges frontmatter tags and inline #tags, folded and unique', () => {
    expect(extractTags('Not #Vize ve #final-sınav, yine #vize', ['Ödev', 'vize'])).toEqual(['ödev', 'vize', 'final-sınav'])
  })

  it('does not treat headings, url fragments or code as tags', () => {
    const md = '# Başlık\n## Alt\nhttps://ornek.com/a#bolum\n`#include`\n```c\n#define X\n```\nC# dili'
    expect(extractTags(md)).toEqual([])
  })

  it('ignores non-array frontmatter tags safely', () => {
    expect(extractTags('#a', 'tek')).toEqual(['tek', 'a'])
    expect(extractTags('', { x: 1 })).toEqual([])
  })
})

describe('renameLinks', () => {
  it('rewrites matching targets and keeps labels', () => {
    const md = '[[Eski]] ve [[eski|görünen]] ve [[Başka]]'
    expect(renameLinks(md, ['Eski'], 'Yeni')).toBe('[[Yeni]] ve [[Yeni|görünen]] ve [[Başka]]')
  })

  it('rewrites path-form targets and leaves code untouched', () => {
    const md = '[[Ders/Eski]]\n```\n[[Eski]]\n```\n`[[Eski]]`'
    expect(renameLinks(md, ['Eski', 'Ders/Eski'], 'Ders/Yeni')).toBe('[[Ders/Yeni]]\n```\n[[Eski]]\n```\n`[[Eski]]`')
  })

  it('returns the same string when nothing matches', () => {
    const md = '[[Başka]]'
    expect(renameLinks(md, ['Eski'], 'Yeni')).toBe(md)
  })
})
