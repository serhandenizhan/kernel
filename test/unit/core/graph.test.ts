import { describe, expect, it } from 'vitest'
import { localGraph, folderColorIndex } from '@core/graph'
import type { GraphData } from '@shared/types'

const node = (id: string, folder = '') => ({ id, title: id, folder, tags: [] })
const g: GraphData = {
  nodes: [node('a'), node('b'), node('c'), node('d'), node('e')],
  links: [
    { source: 'a', target: 'b' },
    { source: 'c', target: 'a' },
    { source: 'b', target: 'd' }
  ]
}

describe('localGraph', () => {
  it('keeps the page and its direct neighbours in both directions', () => {
    const l = localGraph(g, 'a')
    expect(l.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c'])
    expect(l.links).toEqual([
      { source: 'a', target: 'b' },
      { source: 'c', target: 'a' }
    ])
  })
  it('expands to depth 2 and returns an empty graph for an unknown page', () => {
    expect(localGraph(g, 'a', 2).nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(localGraph(g, 'zzz')).toEqual({ nodes: [], links: [] })
  })
})

describe('folderColorIndex', () => {
  it('gives each top folder a stable colour slot, root pages slot 0', () => {
    const idx = folderColorIndex([node('x', 'Fizik'), node('y'), node('z', 'Cebir'), node('w', 'Fizik')], 6)
    expect(idx.get('')).toBe(0)
    expect(idx.get('Cebir')).toBe(1)
    expect(idx.get('Fizik')).toBe(2)
  })
})
