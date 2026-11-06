import { describe, it, expect } from 'vitest'
import { CHART_TYPES, defaultChart, type ChartSpec } from '@core/charts/spec'
import { layoutFlow, niceTicks, project3d, renderChart } from '@core/charts/render'

const L = { item: 'Öğe', series: 'Seri', node: 'Adım', point: 'Nokta' }
const count = (svg: string, cls: string) => (svg.match(new RegExp(`class="${cls}[ "]`, 'g')) ?? []).length
const spec = (type: ChartSpec['type'], patch: Partial<ChartSpec> = {}): ChartSpec => ({ ...defaultChart(type, L), ...patch })

describe('niceTicks', () => {
  it('picks round steps and always includes zero', () => {
    expect(niceTicks(0, 38)).toEqual([0, 10, 20, 30, 40])
    const t = niceTicks(-5, 12)
    expect(t).toContain(0)
    expect(t[0]!).toBeLessThanOrEqual(-5)
    expect(t[t.length - 1]!).toBeGreaterThanOrEqual(12)
    const empty = niceTicks(0, 0)
    expect([empty[0], empty.at(-1)]).toEqual([0, 1])
  })
})

describe('renderChart', () => {
  it('renders every sample without NaN and with a viewBox', () => {
    for (const t of CHART_TYPES) {
      const svg = renderChart(defaultChart(t, L))
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg).toContain('viewBox=')
      expect(svg).not.toMatch(/NaN|undefined|Infinity/)
    }
  })

  it('draws one bar per row and series, tagged with the row index for dragging', () => {
    const s = spec('bar', { series: [{ name: 'A', color: '#14a38b' }, { name: 'B', color: '#4f7cff' }], rows: [{ label: 'x', values: [1, 2] }, { label: 'y', values: [3, -4] }] })
    const svg = renderChart(s)
    expect(count(svg, 'kc-bar')).toBe(4)
    expect(svg).toContain('data-row="1"')
    expect(count(renderChart(spec('hbar')), 'kc-bar')).toBe(4)
  })

  it('draws pie slices with percentages and survives an all-zero pie', () => {
    const svg = renderChart(spec('pie'))
    expect(count(svg, 'kc-slice')).toBe(4)
    expect(svg).toContain('40%')
    const zero = renderChart(spec('pie', { rows: [{ label: 'a', values: [0] }] }))
    expect(zero).not.toMatch(/NaN/)
    expect(count(zero, 'kc-slice')).toBe(0)
    expect(renderChart(spec('donut'))).toContain('kc-total')
    // tek dilim tam daire
    expect(count(renderChart(spec('pie', { rows: [{ label: 'a', values: [5] }] })), 'kc-slice')).toBe(1)
  })

  it('draws a line per series, filled areas and radar polygons', () => {
    expect(count(renderChart(spec('line')), 'kc-line')).toBe(2)
    expect(count(renderChart(spec('area')), 'kc-area')).toBe(2)
    expect(count(renderChart(spec('radar')), 'kc-radar')).toBe(2)
  })

  it('draws scatter points and an optional connecting line', () => {
    expect(count(renderChart(spec('scatter')), 'kc-point')).toBe(5)
    expect(count(renderChart(spec('scatter', { connect: true })), 'kc-line')).toBe(1)
  })

  it('draws the plane in 2D and adds a z axis in 3D', () => {
    const flat = renderChart(spec('plane'))
    expect(count(flat, 'kc-axis-line')).toBe(2)
    expect(count(flat, 'kc-point')).toBe(3)
    const deep = renderChart(spec('plane', { z: true, points: [{ label: 'P', x: 1, y: 2, z: 3 }] }))
    expect(count(deep, 'kc-axis-line')).toBe(3)
    expect(deep).toContain('>z<')
  })

  it('escapes labels', () => {
    const svg = renderChart(spec('bar', { title: '<script>&"', rows: [{ label: '<b>', values: [1] }] }))
    expect(svg).not.toContain('<script>')
    expect(svg).not.toContain('<b>')
    expect(svg).toContain('&lt;script&gt;&amp;&quot;')
  })

  it('draws flow nodes and arrows', () => {
    const svg = renderChart(spec('flow'))
    expect(count(svg, 'kc-node')).toBe(4)
    expect(count(svg, 'kc-edge')).toBe(3)
  })
})

describe('layoutFlow', () => {
  it('ranks nodes along the flow direction and survives cycles', () => {
    const s = spec('flow', { edges: [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }, { from: 'n3', to: 'n1' }, { from: 'n3', to: 'n4' }] })
    const { nodes } = layoutFlow(s)
    const x = (id: string) => nodes.find((n) => n.id === id)!.x
    expect(x('n1')).toBeLessThan(x('n2'))
    expect(x('n2')).toBeLessThan(x('n3'))
    const tb = layoutFlow({ ...s, direction: 'TB' }).nodes
    expect(tb.find((n) => n.id === 'n1')!.y).toBeLessThan(tb.find((n) => n.id === 'n3')!.y)
  })
})

describe('project3d', () => {
  it('maps the origin to the origin and separates the axes', () => {
    expect(project3d({ x: 0, y: 0, z: 0 }, 0.6, 0.4)).toEqual({ x: 0, y: 0 })
    const px = project3d({ x: 1, y: 0, z: 0 }, 0.6, 0.4)
    const pz = project3d({ x: 0, y: 0, z: 1 }, 0.6, 0.4)
    expect(px).not.toEqual(pz)
  })
})

describe('review fixes', () => {
  it('handles tiny and huge values without NaN', () => {
    const tiny = renderChart(spec('bar', { rows: [{ label: 'a', values: [0.001] }, { label: 'b', values: [0.004] }] }))
    expect(tiny).not.toMatch(/NaN|Infinity/)
    expect(tiny).toContain('0,004')
    const t = niceTicks(0, 0.004)
    expect(new Set(t).size).toBe(t.length)
    expect(t.at(-1)!).toBeGreaterThanOrEqual(0.004)
    expect(renderChart(spec('bar', { rows: [{ label: 'a', values: [-1e308] }, { label: 'b', values: [1e308] }] }))).not.toMatch(/NaN|Infinity/)
  })
})
