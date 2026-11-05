import { describe, expect, it } from 'vitest'
import { filterPages, linkTargetFor } from '@core/wiki'
import type { TreeNode } from '@shared/types'

const n = (id: string, title: string, path: string, children: TreeNode[] = []): TreeNode => ({ id, title, path, children })
const tree = [n('1', 'Lineer Cebir', 'Lineer Cebir.md', [n('2', 'Özdeğerler', 'Lineer Cebir/Özdeğerler.md'), n('3', 'Notlar', 'Lineer Cebir/Notlar.md')]), n('4', 'Fizik', 'Fizik.md', [n('5', 'Notlar', 'Fizik/Notlar.md')]), n('6', 'İntegral', 'İntegral.md')]

describe('filterPages', () => {
  it('ranks prefix matches first and folds Turkish case', () => {
    expect(filterPages(tree, 'not').map((p) => p.id)).toEqual(['3', '5'])
    expect(filterPages(tree, 'ÖZD').map((p) => p.id)).toEqual(['2'])
    expect(filterPages(tree, 'ozde').map((p) => p.id)).toEqual(['2'])
    expect(filterPages(tree, 'integ').map((p) => p.id)).toEqual(['6'])
    expect(filterPages(tree, 'cebir').map((p) => p.id)).toEqual(['1', '2', '3'])
    expect(filterPages(tree, 'fizik/not').map((p) => p.id)).toEqual(['5'])
  })
  it('returns recent-ish top pages for an empty query, limited', () => {
    expect(filterPages(tree, '', 2)).toHaveLength(2)
  })
})

describe('linkTargetFor', () => {
  it('uses the title when unique and the path when titles collide', () => {
    expect(linkTargetFor(tree, '2')).toBe('Özdeğerler')
    expect(linkTargetFor(tree, '5')).toBe('Fizik/Notlar')
  })
})
