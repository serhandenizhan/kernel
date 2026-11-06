// Grafik verisi: Markdown'da ```chart kod bloğunda JSON olarak durur (başka editörde okunur, Kernel'de çizilir)

export const CHART_TYPES = ['bar', 'hbar', 'line', 'area', 'pie', 'donut', 'scatter', 'radar', 'flow', 'plane'] as const
export type ChartType = (typeof CHART_TYPES)[number]

/** Açık ve koyu temada okunan orta tonlar */
export const PALETTE = ['#14a38b', '#4f7cff', '#f0a020', '#e5577a', '#8e6cf0', '#5bb35b', '#f07a3a', '#7d8ea0'] as const

export const FLOW_SHAPES = ['box', 'round', 'diamond', 'circle'] as const
export type FlowShape = (typeof FLOW_SHAPES)[number]

export interface Series {
  name: string
  color: string
}
export interface Row {
  label: string
  color?: string
  values: number[]
}
export interface Point {
  label: string
  x: number
  y: number
  z?: number
  color?: string
}
export interface FlowNode {
  id: string
  label: string
  shape: FlowShape
  color?: string
}
export interface FlowEdge {
  from: string
  to: string
  label?: string
}

export interface ChartSpec {
  v: 1
  type: ChartType
  title: string
  /** değerlerin birimi (%, TL, kg …); yalnızca gösterim */
  unit: string
  series: Series[]
  rows: Row[]
  points: Point[]
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** düzlem: z ekseni açık (3B) */
  z: boolean
  /** düzlem / dağılım: noktaları sırayla birleştir */
  connect: boolean
  /** akış yönü: soldan sağa ya da yukarıdan aşağı */
  direction: 'LR' | 'TB'
}

/** Örnek verideki sözcükler (çeviri arayüzden gelir; çekirdek dil bilmez) */
export interface SampleLabels {
  item: string
  series: string
  node: string
  point: string
}

export const usesRows = (t: ChartType): boolean => t !== 'scatter' && t !== 'plane' && t !== 'flow'
export const usesPoints = (t: ChartType): boolean => t === 'scatter' || t === 'plane'
export const isPieLike = (t: ChartType): boolean => t === 'pie' || t === 'donut'
/** birden çok seri gösterebilen türler */
export const multiSeries = (t: ChartType): boolean => t === 'bar' || t === 'hbar' || t === 'line' || t === 'area' || t === 'radar'

const HEX = /^#[0-9a-f]{6}$/i
const color = (v: unknown): string | undefined => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : undefined)
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' ? String(v) : '')
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

function empty(type: ChartType): ChartSpec {
  return { v: 1, type, title: '', unit: '', series: [], rows: [], points: [], nodes: [], edges: [], z: false, connect: false, direction: 'LR' }
}

/** Elle düzenlenmiş / eksik JSON'u güvenli biçime getirir */
export function normalizeChart(raw: Record<string, unknown>): ChartSpec | null {
  const type = raw['type']
  if (typeof type !== 'string' || !(CHART_TYPES as readonly string[]).includes(type)) return null
  const s = empty(type as ChartType)
  s.title = str(raw['title'])
  s.unit = str(raw['unit'], 12)
  s.z = raw['z'] === true
  s.connect = raw['connect'] === true
  s.direction = raw['direction'] === 'TB' ? 'TB' : 'LR'
  s.rows = arr(raw['rows']).slice(0, 60).map((r) => {
    const o = obj(r)
    const row: Row = { label: str(o['label']), values: arr(o['values']).slice(0, 12).map(num) }
    const c = color(o['color'])
    if (c) row.color = c
    if (row.values.length === 0) row.values = [0]
    return row
  })
  const width = Math.max(1, ...s.rows.map((r) => r.values.length))
  s.series = arr(raw['series']).slice(0, 12).map((x, i) => ({ name: str(obj(x)['name']), color: color(obj(x)['color']) ?? PALETTE[i % PALETTE.length]! }))
  // satırlardaki değer sayısı kadar seri olsun
  while ((usesRows(s.type) || s.rows.length) && s.series.length < width) s.series.push({ name: '', color: PALETTE[s.series.length % PALETTE.length]! })
  s.points = arr(raw['points']).slice(0, 200).map((p) => {
    const o = obj(p)
    const pt: Point = { label: str(o['label']), x: num(o['x']), y: num(o['y']) }
    if (o['z'] !== undefined) pt.z = num(o['z'])
    const c = color(o['color'])
    if (c) pt.color = c
    return pt
  })
  const ids = new Set<string>()
  s.nodes = arr(raw['nodes']).slice(0, 60).flatMap((n) => {
    const o = obj(n)
    const id = str(o['id'], 40)
    if (!id || ids.has(id)) return []
    ids.add(id)
    const shape = (FLOW_SHAPES as readonly string[]).includes(o['shape'] as string) ? (o['shape'] as FlowShape) : 'box'
    const node: FlowNode = { id, label: str(o['label']), shape }
    const c = color(o['color'])
    if (c) node.color = c
    return [node]
  })
  s.edges = arr(raw['edges']).slice(0, 120).flatMap((e) => {
    const o = obj(e)
    const from = str(o['from'], 40)
    const to = str(o['to'], 40)
    if (!ids.has(from) || !ids.has(to)) return []
    const edge: FlowEdge = { from, to }
    const label = str(o['label'])
    if (label) edge.label = label
    return [edge]
  })
  return s
}

export function parseChart(text: string): { spec: ChartSpec } | { error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'JSON' }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'not an object' }
  const spec = normalizeChart(raw as Record<string, unknown>)
  return spec ? { spec } : { error: 'unknown chart type' }
}

/** Yalnızca türün kullandığı alanlar yazılır (dosyada okunur kalsın) */
export function serializeChart(s: ChartSpec): string {
  const out: Record<string, unknown> = { v: 1, type: s.type }
  if (s.title) out['title'] = s.title
  if (s.unit) out['unit'] = s.unit
  // tür değiştirilip geri dönülünce veri kaybolmasın: dolu alanlar (türün kullanmadıkları da) korunur
  if (usesRows(s.type) || s.rows.length) {
    out['series'] = s.series
    out['rows'] = s.rows
  }
  if (usesPoints(s.type) || s.points.length) out['points'] = s.points
  if (s.connect) out['connect'] = true
  if (s.z) out['z'] = true
  if (s.type === 'flow' || s.nodes.length) {
    out['nodes'] = s.nodes
    out['edges'] = s.edges
  }
  if (s.direction === 'TB') out['direction'] = 'TB'
  return JSON.stringify(out, null, 2)
}

/** "/" menüsünden eklenince gelen, hemen düzenlenebilir örnek */
export function defaultChart(type: ChartType, L: SampleLabels): ChartSpec {
  const s = empty(type)
  const rows = (vals: number[][]) => vals.map((values, i) => ({ label: `${L.item} ${i + 1}`, values }))
  if (isPieLike(type)) {
    s.series = [{ name: L.series, color: PALETTE[0] }]
    s.rows = rows([[40], [30], [20], [10]]).map((r, i) => ({ ...r, color: PALETTE[i % PALETTE.length]! }))
  } else if (type === 'line' || type === 'area' || type === 'radar') {
    s.series = [
      { name: `${L.series} 1`, color: PALETTE[0] },
      { name: `${L.series} 2`, color: PALETTE[1] }
    ]
    s.rows = rows([
      [12, 8],
      [18, 11],
      [15, 16],
      [24, 19],
      [21, 26]
    ])
  } else if (type === 'bar' || type === 'hbar') {
    s.series = [{ name: L.series, color: PALETTE[0] }]
    s.rows = rows([[24], [38], [17], [31]])
  } else if (type === 'scatter') {
    s.points = [
      [1, 2],
      [2, 3.5],
      [3, 3],
      [4, 5.5],
      [5, 6]
    ].map(([x, y], i) => ({ label: `${L.point} ${i + 1}`, x: x!, y: y! }))
  } else if (type === 'plane') {
    s.points = [
      { label: 'A', x: 1, y: 2 },
      { label: 'B', x: -2, y: 1 },
      { label: 'C', x: 3, y: -1 }
    ]
  } else if (type === 'flow') {
    s.nodes = [
      { id: 'n1', label: `${L.node} 1`, shape: 'round' },
      { id: 'n2', label: `${L.node} 2`, shape: 'box' },
      { id: 'n3', label: `${L.node} 3`, shape: 'diamond' },
      { id: 'n4', label: `${L.node} 4`, shape: 'round' }
    ]
    s.edges = [
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n3' },
      { from: 'n3', to: 'n4' }
    ]
  }
  return s
}
