import { describe, it, expect } from 'vitest'
import { splitFrontmatter, joinFrontmatter } from '../../../../src/main/vault/frontmatter'

const c = '2026-11-04T10:00:00.000Z'
const u = '2026-11-04T11:00:00.000Z'

describe('frontmatter', () => {
  it('yazılan meta geri okunur', () => {
    const t = joinFrontmatter({ id: '01J', icon: '🧮', created: c, updated: u }, 'Merhaba\n')
    expect(splitFrontmatter(t)).toEqual({ meta: { id: '01J', icon: '🧮', created: c, updated: u }, body: 'Merhaba\n' })
  })
  it('alan sırası sabittir ve tanımsız alanlar yazılmaz', () => {
    const t = joinFrontmatter({ updated: u, created: c, id: 'X', cover: 'kernel:teal' }, '')
    expect(t).toBe(`---\nid: X\ncover: kernel:teal\ncreated: ${c}\nupdated: ${u}\n---\n`)
  })
  it('frontmatter yoksa tüm metin gövdedir', () => {
    expect(splitFrontmatter('frontmatter yok')).toEqual({ meta: {}, body: 'frontmatter yok' })
  })
  it('bozuk YAML gövdeyi korur, meta boş döner ve hatayı bildirir', () => {
    expect(splitFrontmatter('---\n: : :\n  - [\n---\ngövde')).toEqual({ meta: {}, body: 'gövde', error: true })
  })
  it('bilinmeyen alanlar bilinenlerden sonra yazılır', () => {
    expect(joinFrontmatter({ id: 'X', created: c, updated: u }, '', { aliases: ['a'], date: '2024' })).toBe(`---\nid: X\ncreated: ${c}\nupdated: ${u}\naliases:\n  - a\ndate: "2024"\n---\n`)
  })
})
