import { type ChartSpec, type FlowNode, PALETTE, isPieLike } from './spec'

// Grafik → SVG metni (saf). Renkler veriden; yazı, eksen ve ızgara renkleri CSS sınıflarından gelir (açık/koyu tema, PDF)
// Sınıflar: kc-title, kc-label, kc-value, kc-grid, kc-axis-line, kc-bar, kc-slice, kc-line, kc-area, kc-dot, kc-point,
// kc-radar, kc-node, kc-edge, kc-total, kc-legend. data-row: sürükle-bırak için satır sırası.

const W = 640

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s)
const r2 = (n: number) => Math.round(n * 100) / 100 || 0
const fmt = (v: number, unit = '') => {
  const n = Math.abs(v) >= 1000 ? Math.round(v) : r2(v)
  return `${String(n).replace('.', ',')}${unit}`
}
const text = (x: number, y: number, s: string, cls: string, anchor = 'middle', extra = '') =>
  `<text class="${cls}" x="${r2(x)}" y="${r2(y)}" text-anchor="${anchor}"${extra}>${esc(s)}</text>`

/** Okunur adımlı eksen değerleri; sıfırı her zaman içerir */
export function niceTicks(min: number, max: number, count = 5): number[] {
  let lo = Math.min(0, min)
  let hi = Math.max(0, max)
  if (lo === hi) hi = lo + 1
  const raw = (hi - lo) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  const out: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) out.push(r2(v))
  return out
}

function svg(width: number, height: number, body: string, title: string): string {
  const t = title ? text(width / 2, 24, title, 'kc-title') : ''
  return `<svg class="kchart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img">${t}${body}</svg>`
}

function legend(items: { name: string; color: string }[], y: number): string {
  const shown = items.filter((i) => i.name)
  if (shown.length < 2) return ''
  const widths = shown.map((i) => Math.min(i.name.length, 18) * 6.6 + 26)
  let x = (W - widths.reduce((a, b) => a + b, 0)) / 2
  return shown
    .map((i, k) => {
      const out = `<g class="kc-legend"><rect x="${r2(x)}" y="${y - 9}" width="10" height="10" rx="3" fill="${i.color}"/>${text(x + 15, y, trunc(i.name, 18), 'kc-label', 'start')}</g>`
      x += widths[k]!
      return out
    })
    .join('')
}

/** Sütun, yatay çubuk, çizgi, alan */
function cartesian(s: ChartSpec): string {
  const H = 360
  const n = Math.max(1, s.rows.length)
  const ns = Math.max(1, s.series.length)
  const hasLegend = ns > 1 && s.series.some((x) => x.name)
  const top = (s.title ? 44 : 18) + (hasLegend ? 24 : 0)
  const horizontal = s.type === 'hbar'
  const labelW = horizontal ? Math.min(140, Math.max(50, ...s.rows.map((r) => Math.min(r.label.length, 20) * 6.6 + 12))) : 0
  const left = horizontal ? labelW + 8 : 52
  const right = W - 20
  const bottom = H - (horizontal ? 28 : 40)
  const vals = s.rows.flatMap((r) => r.values)
  const ticks = niceTicks(Math.min(...vals, 0), Math.max(...vals, 0))
  const lo = ticks[0]!
  const hi = ticks[ticks.length - 1]!
  // değer ekseni: dikeyde y, yatay çubukta x
  const vy = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top)
  const vx = (v: number) => left + ((v - lo) / (hi - lo)) * (right - left)
  const parts: string[] = []
  for (const t of ticks) {
    if (horizontal) {
      parts.push(`<line class="kc-grid" x1="${r2(vx(t))}" x2="${r2(vx(t))}" y1="${top}" y2="${bottom}"/>`, text(vx(t), bottom + 18, fmt(t, s.unit), 'kc-label'))
    } else {
      parts.push(`<line class="kc-grid" x1="${left}" x2="${right}" y1="${r2(vy(t))}" y2="${r2(vy(t))}"/>`, text(left - 8, vy(t) + 4, fmt(t, s.unit), 'kc-label', 'end'))
    }
  }
  const band = ((horizontal ? bottom - top : right - left) / n) as number
  const center = (i: number) => (horizontal ? top : left) + band * (i + 0.5)
  const showValues = n * ns <= 16
  if (s.type === 'bar' || s.type === 'hbar') {
    const bw = Math.min(horizontal ? 34 : 56, (band * 0.72) / ns)
    s.rows.forEach((row, i) => {
      row.values.forEach((v, k) => {
        const fill = ns === 1 ? (row.color ?? s.series[0]?.color ?? PALETTE[i % PALETTE.length]) : (s.series[k]?.color ?? PALETTE[k % PALETTE.length])
        const offset = center(i) - (bw * ns) / 2 + bw * k
        if (horizontal) {
          const x0 = vx(Math.min(0, v))
          const w = Math.abs(vx(v) - vx(0))
          parts.push(`<rect class="kc-bar" data-row="${i}" x="${r2(x0)}" y="${r2(offset + 1)}" width="${r2(w)}" height="${r2(bw - 2)}" rx="4" fill="${fill}"/>`)
          if (showValues) parts.push(text(v >= 0 ? vx(v) + 6 : vx(v) - 6, offset + bw / 2 + 4, fmt(v, s.unit), 'kc-value', v >= 0 ? 'start' : 'end'))
        } else {
          const y0 = vy(Math.max(0, v))
          const h = Math.abs(vy(v) - vy(0))
          parts.push(`<rect class="kc-bar" data-row="${i}" x="${r2(offset + 1)}" y="${r2(y0)}" width="${r2(bw - 2)}" height="${r2(h)}" rx="4" fill="${fill}"/>`)
          if (showValues) parts.push(text(offset + bw / 2, v >= 0 ? vy(v) - 6 : vy(v) + 14, fmt(v, s.unit), 'kc-value'))
        }
      })
    })
  } else {
    s.series.forEach((ser, k) => {
      const pts = s.rows.map((r, i) => [center(i), vy(r.values[k] ?? 0)] as const)
      const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join(' ')
      if (s.type === 'area' && pts.length) {
        parts.push(`<path class="kc-area" d="${d} L${r2(pts[pts.length - 1]![0])} ${r2(vy(Math.max(lo, 0)))} L${r2(pts[0]![0])} ${r2(vy(Math.max(lo, 0)))} Z" fill="${ser.color}" fill-opacity="0.18"/>`)
      }
      parts.push(`<path class="kc-line" d="${d}" fill="none" stroke="${ser.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`)
      for (const [x, y] of pts) parts.push(`<circle class="kc-dot" cx="${r2(x)}" cy="${r2(y)}" r="3.5" fill="${ser.color}"/>`)
    })
  }
  // kategori etiketleri
  const maxChars = Math.max(3, Math.floor(band / 7))
  s.rows.forEach((row, i) => {
    if (horizontal) parts.push(text(left - 8, center(i) + 4, trunc(row.label, 20), 'kc-label', 'end'))
    else parts.push(text(center(i), bottom + 20, trunc(row.label, maxChars), 'kc-label'))
  })
  parts.push(`<line class="kc-axis-base" x1="${horizontal ? r2(vx(0)) : left}" x2="${horizontal ? r2(vx(0)) : right}" y1="${horizontal ? top : r2(vy(0))}" y2="${horizontal ? bottom : r2(vy(0))}"/>`)
  return svg(W, H, (hasLegend ? legend(s.series, (s.title ? 44 : 18) + 8) : '') + parts.join(''), s.title)
}

/** Pasta ve halka */
function pie(s: ChartSpec): string {
  const H = 320
  const top = s.title ? 36 : 8
  const cx = 200
  const cy = top + (H - top) / 2
  const R = Math.min(130, (H - top) / 2 - 12)
  const inner = s.type === 'donut' ? R * 0.6 : 0
  const items = s.rows.map((r, i) => ({ label: r.label, v: Math.max(0, r.values[0] ?? 0), color: r.color ?? PALETTE[i % PALETTE.length]!, i }))
  const total = items.reduce((a, b) => a + b.v, 0)
  const parts: string[] = []
  if (total <= 0) {
    parts.push(`<circle class="kc-empty" cx="${cx}" cy="${r2(cy)}" r="${r2(R)}" fill="none"/>`)
  } else {
    let a0 = -Math.PI / 2
    const pt = (a: number, r: number) => `${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`
    for (const it of items) {
      if (it.v <= 0) continue
      const frac = it.v / total
      const a1 = a0 + frac * Math.PI * 2
      if (frac >= 0.9999) {
        parts.push(`<circle class="kc-slice" data-row="${it.i}" cx="${cx}" cy="${r2(cy)}" r="${r2(R)}" fill="${it.color}"/>`)
        if (inner) parts.push(`<circle class="kc-hole" cx="${cx}" cy="${r2(cy)}" r="${r2(inner)}"/>`)
      } else {
        const large = a1 - a0 > Math.PI ? 1 : 0
        const d = inner
          ? `M${pt(a0, R)} A${R} ${R} 0 ${large} 1 ${pt(a1, R)} L${pt(a1, inner)} A${r2(inner)} ${r2(inner)} 0 ${large} 0 ${pt(a0, inner)} Z`
          : `M${cx} ${r2(cy)} L${pt(a0, R)} A${R} ${R} 0 ${large} 1 ${pt(a1, R)} Z`
        parts.push(`<path class="kc-slice" data-row="${it.i}" d="${d}" fill="${it.color}"/>`)
      }
      if (frac >= 0.05) {
        const mid = (a0 + a1) / 2
        const lr = inner ? (R + inner) / 2 : R * 0.64
        parts.push(text(cx + lr * Math.cos(mid), cy + lr * Math.sin(mid) + 4, `${Math.round(frac * 100)}%`, 'kc-slice-label'))
      }
      a0 = a1
    }
    if (inner) parts.push(text(cx, cy + 2, fmt(total, s.unit), 'kc-total'), text(cx, cy + 20, '', 'kc-label'))
  }
  // açıklama (sağda): renk, ad, değer
  const ly0 = cy - (items.length * 24) / 2 + 12
  items.forEach((it, k) => {
    const y = ly0 + k * 24
    parts.push(`<g class="kc-legend" data-row="${it.i}"><rect x="372" y="${r2(y - 10)}" width="12" height="12" rx="3" fill="${it.color}"/>${text(392, y, trunc(it.label, 22), 'kc-label', 'start')}${text(W - 24, y, fmt(it.v, s.unit), 'kc-value', 'end')}</g>`)
  })
  return svg(W, H, parts.join(''), s.title)
}

/** Radar (örümcek ağı) */
function radar(s: ChartSpec): string {
  const H = 380
  const hasLegend = s.series.length > 1 && s.series.some((x) => x.name)
  const top = (s.title ? 40 : 10) + (hasLegend ? 24 : 0)
  const cx = W / 2
  const cy = top + (H - top) / 2
  const R = (H - top) / 2 - 34
  const n = Math.max(3, s.rows.length)
  const max = niceTicks(0, Math.max(...s.rows.flatMap((r) => r.values), 0)).at(-1)!
  const ang = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2
  const at = (i: number, r: number) => `${r2(cx + r * Math.cos(ang(i)))},${r2(cy + r * Math.sin(ang(i)))}`
  const parts: string[] = []
  for (const f of [0.25, 0.5, 0.75, 1]) {
    parts.push(`<polygon class="kc-grid" fill="none" points="${Array.from({ length: n }, (_, i) => at(i, R * f)).join(' ')}"/>`)
  }
  for (let i = 0; i < n; i++) {
    parts.push(`<line class="kc-grid" x1="${cx}" y1="${r2(cy)}" x2="${at(i, R).split(',')[0]}" y2="${at(i, R).split(',')[1]}"/>`)
    const label = s.rows[i]?.label ?? ''
    const lx = cx + (R + 16) * Math.cos(ang(i))
    const anchor = Math.abs(Math.cos(ang(i))) < 0.2 ? 'middle' : Math.cos(ang(i)) > 0 ? 'start' : 'end'
    parts.push(text(lx, cy + (R + 16) * Math.sin(ang(i)) + 4, trunc(label, 16), 'kc-label', anchor))
  }
  s.series.forEach((ser, k) => {
    const pts = Array.from({ length: n }, (_, i) => at(i, (Math.max(0, s.rows[i]?.values[k] ?? 0) / max) * R)).join(' ')
    parts.push(`<polygon class="kc-radar" points="${pts}" fill="${ser.color}" fill-opacity="0.2" stroke="${ser.color}" stroke-width="2" stroke-linejoin="round"/>`)
  })
  return svg(W, H, (hasLegend ? legend(s.series, (s.title ? 40 : 10) + 10) : '') + parts.join(''), s.title)
}

/** Dağılım ve 2B düzlem */
function scatterOrPlane(s: ChartSpec): string {
  const plane = s.type === 'plane'
  const H = plane ? 420 : 360
  const top = (s.title ? 40 : 16) + (s.type === 'plane' ? 14 : 0)
  const pts = s.points
  let xt: number[]
  let yt: number[]
  if (plane) {
    // düzlem kare ve simetrik: orijin ortada
    // en uzak nokta kenara yapışmasın: %15 pay
    const e = niceTicks(0, Math.max(1, ...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))) * 1.15, 4).at(-1)!
    xt = niceTicks(-e, e, 8)
    yt = xt
  } else {
    const pad = (v: number) => (v > 0 ? v * 1.1 : v * 1.1)
    xt = niceTicks(pad(Math.min(...pts.map((p) => p.x), 0)), pad(Math.max(...pts.map((p) => p.x), 1)))
    yt = niceTicks(pad(Math.min(...pts.map((p) => p.y), 0)), pad(Math.max(...pts.map((p) => p.y), 1)))
  }
  const size = H - top - 36
  const left = plane ? (W - size) / 2 : 52
  const right = plane ? left + size : W - 20
  const bottom = top + size
  const x = (v: number) => left + ((v - xt[0]!) / (xt.at(-1)! - xt[0]!)) * (right - left)
  const y = (v: number) => bottom - ((v - yt[0]!) / (yt.at(-1)! - yt[0]!)) * (bottom - top)
  const parts: string[] = []
  for (const t of xt) parts.push(`<line class="kc-grid" x1="${r2(x(t))}" x2="${r2(x(t))}" y1="${top}" y2="${bottom}"/>`)
  for (const t of yt) parts.push(`<line class="kc-grid" x1="${left}" x2="${right}" y1="${r2(y(t))}" y2="${r2(y(t))}"/>`)
  if (plane) {
    parts.push(`<line class="kc-axis-line" x1="${left}" x2="${right}" y1="${r2(y(0))}" y2="${r2(y(0))}"/>`, `<line class="kc-axis-line" x1="${r2(x(0))}" x2="${r2(x(0))}" y1="${top}" y2="${bottom}"/>`)
    parts.push(text(right + 10, y(0) + 4, 'x', 'kc-axis-name', 'start'), text(x(0), top - 6, 'y', 'kc-axis-name'))
    for (const t of xt) if (t !== 0) parts.push(text(x(t), y(0) + 15, fmt(t), 'kc-tick'))
    for (const t of yt) if (t !== 0) parts.push(text(x(0) - 6, y(t) + 4, fmt(t), 'kc-tick', 'end'))
  } else {
    for (const t of xt) parts.push(text(x(t), bottom + 18, fmt(t), 'kc-label'))
    for (const t of yt) parts.push(text(left - 8, y(t) + 4, fmt(t), 'kc-label', 'end'))
  }
  if (s.connect && pts.length > 1) {
    parts.push(`<path class="kc-line" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${r2(x(p.x))} ${r2(y(p.y))}`).join(' ')}" fill="none" stroke="${PALETTE[1]}" stroke-width="2.5" stroke-linejoin="round"/>`)
  }
  pts.forEach((p, i) => {
    const c = p.color ?? PALETTE[plane ? 3 : 0]
    parts.push(`<circle class="kc-point" data-row="${i}" cx="${r2(x(p.x))}" cy="${r2(y(p.y))}" r="5.5" fill="${c}"/>`)
    const label = plane ? `${p.label ? `${p.label} ` : ''}(${fmt(p.x)}, ${fmt(p.y)})` : p.label
    if (label) parts.push(text(x(p.x) + 8, y(p.y) - 8, trunc(label, 24), 'kc-point-label', 'start'))
  })
  return svg(W, H, parts.join(''), s.title)
}

/** 3B düzlem için izdüşüm: z yukarı; yaw z ekseni çevresinde, pitch bakış eğimi */
export function project3d(p: { x: number; y: number; z: number }, yaw: number, pitch: number): { x: number; y: number } {
  const xr = p.x * Math.cos(yaw) - p.y * Math.sin(yaw)
  const yr = p.x * Math.sin(yaw) + p.y * Math.cos(yaw)
  const sx = xr
  const sy = -(p.z * Math.cos(pitch) + yr * Math.sin(pitch))
  return { x: r2(sx) || 0, y: r2(sy) || 0 }
}

function plane3d(s: ChartSpec, yaw: number, pitch: number): string {
  const H = 440
  const top = s.title ? 40 : 10
  const e = niceTicks(0, Math.max(1, ...s.points.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z ?? 0)))) * 1.15, 4).at(-1)!
  const scale = (H - top - 40) / (2.4 * e)
  const cx = W / 2
  const cy = top + (H - top) / 2
  const P = (x: number, y: number, z: number) => {
    const q = project3d({ x, y, z }, yaw, pitch)
    return [r2(cx + q.x * scale), r2(cy + q.y * scale)] as const
  }
  const parts: string[] = []
  // xy düzleminde ızgara
  const ticks = niceTicks(-e, e, 4)
  for (const t of ticks) {
    const [a1, b1] = P(t, -e, 0)
    const [a2, b2] = P(t, e, 0)
    const [c1, d1] = P(-e, t, 0)
    const [c2, d2] = P(e, t, 0)
    parts.push(`<line class="kc-grid" x1="${a1}" y1="${b1}" x2="${a2}" y2="${b2}"/>`, `<line class="kc-grid" x1="${c1}" y1="${d1}" x2="${c2}" y2="${d2}"/>`)
  }
  const axes: [string, [number, number, number]][] = [
    ['x', [1, 0, 0]],
    ['y', [0, 1, 0]],
    ['z', [0, 0, 1]]
  ]
  for (const [name, [ax, ay, az]] of axes) {
    const [x1, y1] = P(-ax * e, -ay * e, -az * e)
    const [x2, y2] = P(ax * e * 1.12, ay * e * 1.12, az * e * 1.12)
    parts.push(`<line class="kc-axis-line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`)
    const [lx, ly] = P(ax * e * 1.22, ay * e * 1.22, az * e * 1.22)
    parts.push(text(lx, ly + 4, name, 'kc-axis-name'))
  }
  if (s.connect && s.points.length > 1) {
    parts.push(`<path class="kc-line" d="${s.points.map((p, i) => `${i ? 'L' : 'M'}${P(p.x, p.y, p.z ?? 0).join(' ')}`).join(' ')}" fill="none" stroke="${PALETTE[1]}" stroke-width="2.5"/>`)
  }
  s.points.forEach((p, i) => {
    const z = p.z ?? 0
    const [px, py] = P(p.x, p.y, z)
    const [gx, gy] = P(p.x, p.y, 0)
    // noktadan xy düzlemine kesikli dikme: derinlik algısı
    if (z !== 0) parts.push(`<line class="kc-guide" x1="${px}" y1="${py}" x2="${gx}" y2="${gy}"/>`)
    parts.push(`<circle class="kc-point" data-row="${i}" cx="${px}" cy="${py}" r="5.5" fill="${p.color ?? PALETTE[3]}"/>`)
    parts.push(text(px + 8, py - 8, trunc(`${p.label ? `${p.label} ` : ''}(${fmt(p.x)}, ${fmt(p.y)}, ${fmt(z)})`, 28), 'kc-point-label', 'start'))
  })
  return svg(W, H, parts.join(''), s.title)
}

// --- akış diyagramı ---

export interface FlowBox {
  id: string
  x: number
  y: number
  w: number
  h: number
}

const nodeSize = (n: FlowNode) => {
  const w = Math.min(190, Math.max(96, Math.min(n.label.length, 26) * 7 + 32))
  if (n.shape === 'diamond') return { w: w + 30, h: 64 }
  if (n.shape === 'circle') return { w: Math.max(72, w * 0.8), h: Math.max(72, w * 0.8) }
  return { w, h: 44 }
}

/** Katmanlı yerleşim: düğümün katmanı = kaynaktan en uzun yol (döngüdeki geri kenarlar yok sayılır) */
export function layoutFlow(s: ChartSpec): { nodes: FlowBox[]; width: number; height: number } {
  const ids = s.nodes.map((n) => n.id)
  const out = new Map(ids.map((id) => [id, [] as string[]]))
  for (const e of s.edges) out.get(e.from)?.push(e.to)
  // geri kenarları bul (DFS)
  const state = new Map<string, 0 | 1 | 2>()
  const back = new Set<string>()
  const dfs = (u: string) => {
    state.set(u, 1)
    for (const v of out.get(u) ?? []) {
      if (state.get(v) === 1) back.add(`${u}>${v}`)
      else if (!state.get(v)) dfs(v)
    }
    state.set(u, 2)
  }
  for (const id of ids) if (!state.get(id)) dfs(id)
  const rank = new Map(ids.map((id) => [id, 0]))
  // en uzun yol: düğüm sayısı kadar gevşetme (DAG'de yeter)
  for (let k = 0; k < ids.length; k++) {
    for (const e of s.edges) {
      if (back.has(`${e.from}>${e.to}`)) continue
      const r = rank.get(e.from)! + 1
      if (r > rank.get(e.to)!) rank.set(e.to, r)
    }
  }
  const layers: string[][] = []
  for (const id of ids) (layers[rank.get(id)!] ??= []).push(id)
  const lr = s.direction !== 'TB'
  const size = new Map(s.nodes.map((n) => [n.id, nodeSize(n)]))
  const gapMain = 70
  const gapCross = 28
  const boxes: FlowBox[] = []
  // her katmanın ana eksendeki kalınlığı
  const thickness = layers.map((l) => Math.max(...(l ?? []).map((id) => (lr ? size.get(id)!.w : size.get(id)!.h))))
  const crossLen = layers.map((l) => (l ?? []).reduce((a, id) => a + (lr ? size.get(id)!.h : size.get(id)!.w), 0) + gapCross * ((l?.length ?? 1) - 1))
  const maxCross = Math.max(0, ...crossLen)
  let main = 24
  layers.forEach((l, li) => {
    let cross = 24 + (maxCross - crossLen[li]!) / 2
    for (const id of l ?? []) {
      const { w, h } = size.get(id)!
      const mainC = main + thickness[li]! / 2
      if (lr) boxes.push({ id, x: mainC, y: cross + h / 2, w, h })
      else boxes.push({ id, x: cross + w / 2, y: mainC, w, h })
      cross += (lr ? h : w) + gapCross
    }
    main += thickness[li]! + gapMain
  })
  const mainTotal = main - gapMain + 24
  const crossTotal = maxCross + 48
  return { nodes: boxes, width: lr ? mainTotal : crossTotal, height: lr ? crossTotal : mainTotal }
}

function flow(s: ChartSpec): string {
  const lay = layoutFlow(s)
  const top = s.title ? 40 : 0
  const width = Math.max(W, lay.width)
  const height = Math.max(120, lay.height + top)
  const dx = (width - lay.width) / 2
  const box = new Map(lay.nodes.map((b) => [b.id, { ...b, x: b.x + dx, y: b.y + top }]))
  const lr = s.direction !== 'TB'
  const parts: string[] = []
  for (const e of s.edges) {
    const a = box.get(e.from)
    const b = box.get(e.to)
    if (!a || !b) continue
    const forward = lr ? b.x > a.x : b.y > a.y
    const [x1, y1] = lr ? [a.x + (forward ? a.w / 2 : 0), a.y + (forward ? 0 : a.h / 2)] : [a.x + (forward ? 0 : a.w / 2), a.y + (forward ? a.h / 2 : 0)]
    const [x2, y2] = lr ? [b.x - (forward ? b.w / 2 : 0), b.y + (forward ? 0 : b.h / 2)] : [b.x + (forward ? 0 : b.w / 2), b.y - (forward ? b.h / 2 : 0)]
    const bend = forward ? 0.5 : 1.4
    const d = lr
      ? `M${r2(x1)} ${r2(y1)} C${r2(x1 + (x2 - x1) * bend + (forward ? 0 : 40))} ${r2(y1 + (forward ? 0 : 50))} ${r2(x2 - (x2 - x1) * (forward ? bend : 0) - (forward ? 0 : 40))} ${r2(y2 + (forward ? 0 : 50))} ${r2(x2)} ${r2(y2)}`
      : `M${r2(x1)} ${r2(y1)} C${r2(x1 + (forward ? 0 : 60))} ${r2(y1 + (y2 - y1) * bend)} ${r2(x2 + (forward ? 0 : 60))} ${r2(y2 - (y2 - y1) * (forward ? bend : 0))} ${r2(x2)} ${r2(y2)}`
    parts.push(`<path class="kc-edge" d="${d}" fill="none"/>`)
    // ok ucu: son teğete göre
    const ang = forward ? (lr ? 0 : Math.PI / 2) : lr ? Math.PI / 2 : 0
    const ux = Math.cos(ang)
    const uy = Math.sin(ang)
    const p1 = `${r2(x2 - ux * 9 - uy * 5)},${r2(y2 - uy * 9 + ux * 5)}`
    const p2 = `${r2(x2 - ux * 9 + uy * 5)},${r2(y2 - uy * 9 - ux * 5)}`
    parts.push(`<polygon class="kc-arrow" points="${r2(x2)},${r2(y2)} ${p1} ${p2}"/>`)
    if (e.label) {
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      const lw = Math.min(e.label.length, 18) * 6.4 + 12
      parts.push(`<rect class="kc-edge-label-bg" x="${r2(mx - lw / 2)}" y="${r2(my - 10)}" width="${r2(lw)}" height="18" rx="5"/>`, text(mx, my + 3, trunc(e.label, 18), 'kc-edge-label'))
    }
  }
  s.nodes.forEach((n, i) => {
    const b = box.get(n.id)!
    const c = n.color ?? PALETTE[i % PALETTE.length]!
    const style = `fill="${c}" fill-opacity="0.16" stroke="${c}" stroke-width="1.6"`
    const x0 = r2(b.x - b.w / 2)
    const y0 = r2(b.y - b.h / 2)
    let shape: string
    if (n.shape === 'diamond') shape = `<polygon class="kc-node" data-row="${i}" points="${r2(b.x)},${y0} ${r2(b.x + b.w / 2)},${r2(b.y)} ${r2(b.x)},${r2(b.y + b.h / 2)} ${x0},${r2(b.y)}" ${style}/>`
    else if (n.shape === 'circle') shape = `<ellipse class="kc-node" data-row="${i}" cx="${r2(b.x)}" cy="${r2(b.y)}" rx="${r2(b.w / 2)}" ry="${r2(b.h / 2)}" ${style}/>`
    else shape = `<rect class="kc-node" data-row="${i}" x="${x0}" y="${y0}" width="${r2(b.w)}" height="${r2(b.h)}" rx="${n.shape === 'round' ? r2(b.h / 2) : 9}" ${style}/>`
    parts.push(shape, text(b.x, b.y + 4, trunc(n.label, n.shape === 'diamond' ? 18 : 26), 'kc-node-label'))
  })
  return svg(width, height, parts.join(''), s.title)
}

export interface RenderOptions {
  /** 3B düzlem görünüm açıları (radyan) */
  yaw?: number
  pitch?: number
}

export function renderChart(s: ChartSpec, opts: RenderOptions = {}): string {
  if (isPieLike(s.type)) return pie(s)
  if (s.type === 'radar') return radar(s)
  if (s.type === 'flow') return flow(s)
  if (s.type === 'plane' && s.z) return plane3d(s, opts.yaw ?? 0.7, opts.pitch ?? 0.45)
  if (s.type === 'scatter' || s.type === 'plane') return scatterOrPlane(s)
  return cartesian(s)
}
