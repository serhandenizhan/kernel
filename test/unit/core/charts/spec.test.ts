import { describe, it, expect } from 'vitest'
import { CHART_TYPES, PALETTE, defaultChart, parseChart, serializeChart } from '@core/charts/spec'

const L = { item: 'Öğe', series: 'Seri', node: 'Adım', point: 'Nokta' }

describe('chart spec', () => {
  it('offers eight charts plus flow and plane, each with a ready-to-edit sample', () => {
    expect(CHART_TYPES).toEqual(['bar', 'hbar', 'line', 'area', 'pie', 'donut', 'scatter', 'radar', 'flow', 'plane'])
    for (const t of CHART_TYPES) {
      const s = defaultChart(t, L)
      expect(s.type).toBe(t)
      const back = parseChart(serializeChart(s))
      expect('spec' in back && back.spec).toEqual(s)
    }
    expect(defaultChart('pie', L).rows.length).toBeGreaterThanOrEqual(3)
    expect(defaultChart('flow', L).nodes.length).toBeGreaterThanOrEqual(3)
    expect(defaultChart('plane', L).points.length).toBeGreaterThanOrEqual(2)
  })

  it('normalizes partial or hand-edited JSON instead of failing', () => {
    const r = parseChart('{"type":"bar","rows":[{"label":"A","values":["3", null]},{"values":[2]}]}')
    expect('spec' in r).toBe(true)
    if (!('spec' in r)) return
    expect(r.spec.rows).toEqual([
      { label: 'A', values: [3, 0] },
      { label: '', values: [2] }
    ])
    expect(r.spec.series.length).toBeGreaterThan(0)
    expect(r.spec.series[0]!.color).toBe(PALETTE[0])
  })

  it('reports broken JSON and unknown types', () => {
    expect(parseChart('{oops')).toHaveProperty('error')
    expect(parseChart('{"type":"teapot"}')).toHaveProperty('error')
    expect(parseChart('[]')).toHaveProperty('error')
  })

  it('drops unsafe colors and keeps only hex', () => {
    const r = parseChart('{"type":"pie","rows":[{"label":"x","values":[1],"color":"url(javascript:1)"}]}')
    expect('spec' in r && r.spec.rows[0]!.color).toBeUndefined()
  })

  it('serializes compactly and only the fields the type uses', () => {
    const s = defaultChart('pie', L)
    const json = JSON.parse(serializeChart(s))
    expect(json.nodes).toBeUndefined()
    expect(json.points).toBeUndefined()
    expect(json.v).toBe(1)
  })
})
