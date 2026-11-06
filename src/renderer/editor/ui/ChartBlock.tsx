import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NodeViewProps } from '@tiptap/react'
import { CHART_TYPES, FLOW_SHAPES, PALETTE, type ChartSpec, type ChartType, isPieLike, multiSeries, serializeChart, usesPoints, usesRows } from '@core/charts/spec'
import { renderChart } from '@core/charts/render'
import { tNow } from '../../lib/i18n'
import type { MessageKey } from '@shared/i18n'

/** "/" menüsünden eklenen grafik açılınca düzenleme paneli hemen açık gelsin */
export const chartFocus = { pending: false }

const TYPE_ICON: Record<ChartType, string> = { bar: '▮▮', hbar: '☰', line: '⟋', area: '◭', pie: '◔', donut: '◎', scatter: '⁘', radar: '✶', flow: '⇢', plane: '⊹' }
export const typeLabel = (t: ChartType) => tNow(`chart.type.${t}` as MessageKey)

const move = <T,>(list: T[], from: number, to: number): T[] => {
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x!)
  return next
}
const toNum = (v: string) => {
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/** Sayı kutusu: yazarken "1," gibi ara hâller bozulmaz; dışarıdan değer değişince (sıralama) güncellenir */
function NumInput({ value, onValue, ...rest }: { value: number; onValue(n: number): void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(String(value).replace('.', ','))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(String(value).replace('.', ','))
  }, [value])
  return (
    <input
      {...rest}
      inputMode="decimal"
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false
        setText(String(value).replace('.', ','))
      }}
      onChange={(e) => {
        setText(e.target.value)
        onValue(toNum(e.target.value))
      }}
    />
  )
}

/** Palet penceresi ekranda kalsın: altta yer yoksa düğmenin üstünde, sağ kenarı taşmasın */
const SWATCH_W = 170
const SWATCH_H = 96
function swatchPosition(anchor: DOMRect): React.CSSProperties {
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - SWATCH_W - 8))
  return anchor.bottom + 6 + SWATCH_H > window.innerHeight ? { left, bottom: window.innerHeight - anchor.top + 6 } : { left, top: anchor.bottom + 6 }
}

/** Renk seçici: paletten tıkla ya da özel renk */
function ColorButton({ value, onChange, testid }: { value: string; onChange(c: string): void; testid: string }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!anchor) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAnchor(null)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [anchor])
  return (
    <>
      <button type="button" className="chart-color" data-testid={testid} style={{ background: value }} aria-label={tNow('chart.color')} onClick={(e) => setAnchor(e.currentTarget.getBoundingClientRect())} />
      {anchor &&
        createPortal(
          <div ref={ref} className="chart-swatches glass glass-pop" style={swatchPosition(anchor)}>
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                data-testid="chart-swatch"
                className={`chart-swatch${c === value ? ' active' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  onChange(c)
                  setAnchor(null)
                }}
              />
            ))}
            <label className="chart-swatch chart-custom" title={tNow('chart.customColor')}>
              <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
            </label>
          </div>,
          document.body
        )}
    </>
  )
}

/** Satır / nokta / düğüm listesi: tutamakla sürükle-bırak */
function useRowDrag(onMove: (from: number, to: number) => void) {
  const from = useRef<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  return {
    over,
    handle: (i: number) => ({
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        from.current = i
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(i))
      },
      onDragEnd: () => {
        from.current = null
        setOver(null)
      }
    }),
    row: (i: number) => ({
      onDragOver: (e: React.DragEvent) => {
        if (from.current === null) return
        e.preventDefault()
        setOver(i)
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        if (from.current !== null && from.current !== i) onMove(from.current, i)
        from.current = null
        setOver(null)
      }
    })
  }
}

function ChartEditor({ spec, set, onDone }: { spec: ChartSpec; set(next: ChartSpec): void; onDone(): void }) {
  const patch = (p: Partial<ChartSpec>) => set({ ...spec, ...p })
  const rowDrag = useRowDrag((a, b) => patch({ rows: move(spec.rows, a, b) }))
  const pointDrag = useRowDrag((a, b) => patch({ points: move(spec.points, a, b) }))
  const nodeDrag = useRowDrag((a, b) => patch({ nodes: move(spec.nodes, a, b) }))
  const rowColors = isPieLike(spec.type) || (spec.series.length <= 1 && (spec.type === 'bar' || spec.type === 'hbar'))

  const changeType = (type: ChartType) => {
    const next: ChartSpec = { ...spec, type }
    // satırlı türe geçerken boşsa örnek satırlar, pasta için tek seri
    if (usesRows(type) && next.rows.length === 0) next.rows = [1, 2, 3].map((i) => ({ label: `${tNow('chart.sample.item')} ${i}`, values: [i * 10] }))
    if (usesRows(type) && next.series.length === 0) next.series = [{ name: '', color: PALETTE[0] }]
    if (isPieLike(type)) next.rows = next.rows.map((r, i) => ({ ...r, color: r.color ?? PALETTE[i % PALETTE.length]! }))
    if (usesPoints(type) && next.points.length === 0) next.points = [{ label: 'A', x: 1, y: 2 }, { label: 'B', x: 3, y: 1 }]
    if (type === 'flow' && next.nodes.length === 0) {
      next.nodes = [1, 2, 3].map((i) => ({ id: `n${i}`, label: `${tNow('chart.sample.node')} ${i}`, shape: 'box' as const }))
      next.edges = [{ from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }]
    }
    set(next)
  }
  const addSeries = () => {
    const k = spec.series.length
    set({ ...spec, series: [...spec.series, { name: `${tNow('chart.sample.series')} ${k + 1}`, color: PALETTE[k % PALETTE.length]! }], rows: spec.rows.map((r) => ({ ...r, values: [...r.values, 0] })) })
  }
  const removeSeries = (k: number) =>
    set({ ...spec, series: spec.series.filter((_, i) => i !== k), rows: spec.rows.map((r) => ({ ...r, values: r.values.filter((_, i) => i !== k) })) })
  const newId = () => {
    let i = spec.nodes.length + 1
    while (spec.nodes.some((n) => n.id === `n${i}`)) i++
    return `n${i}`
  }

  return (
    <div className="chart-editor" data-testid="chart-editor" contentEditable={false}>
      <div className="chart-types" role="radiogroup" aria-label={tNow('chart.typeLabel')}>
        {CHART_TYPES.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={spec.type === t} data-testid={`chart-type-${t}`} className={`chart-type${spec.type === t ? ' active' : ''}`} title={typeLabel(t)} onClick={() => changeType(t)}>
            <span aria-hidden="true">{TYPE_ICON[t]}</span>
            <small>{typeLabel(t)}</small>
          </button>
        ))}
      </div>
      <div className="chart-fields">
        <input className="chart-input grow" data-testid="chart-title" placeholder={tNow('chart.title')} value={spec.title} onChange={(e) => patch({ title: e.target.value })} />
        {usesRows(spec.type) && <input className="chart-input unit" data-testid="chart-unit" placeholder={tNow('chart.unit')} value={spec.unit} onChange={(e) => patch({ unit: e.target.value })} />}
      </div>

      {usesRows(spec.type) && (
        <>
          {multiSeries(spec.type) && (
            <div className="chart-series">
              {spec.series.map((s, k) => (
                <span key={k} className="chart-chip">
                  <ColorButton value={s.color} testid="chart-series-color" onChange={(c) => patch({ series: spec.series.map((x, i) => (i === k ? { ...x, color: c } : x)) })} />
                  <input className="chart-input" data-testid="chart-series-name" placeholder={tNow('chart.seriesName')} value={s.name} onChange={(e) => patch({ series: spec.series.map((x, i) => (i === k ? { ...x, name: e.target.value } : x)) })} />
                  {spec.series.length > 1 && (
                    <button type="button" className="chart-x" aria-label={tNow('chart.remove')} onClick={() => removeSeries(k)}>
                      ×
                    </button>
                  )}
                </span>
              ))}
              {spec.series.length < 6 && (
                <button type="button" className="chart-add" data-testid="chart-add-series" onClick={addSeries}>
                  + {tNow('chart.addSeries')}
                </button>
              )}
            </div>
          )}
          <div className="chart-rows">
            {spec.rows.map((r, i) => (
              <div key={i} className={`chart-row${rowDrag.over === i ? ' over' : ''}`} data-testid="chart-row" {...rowDrag.row(i)}>
                <span className="chart-handle" data-testid="chart-row-handle" title={tNow('chart.dragHint')} {...rowDrag.handle(i)}>
                  ⋮⋮
                </span>
                {rowColors && <ColorButton value={r.color ?? PALETTE[i % PALETTE.length]!} testid="chart-row-color" onChange={(c) => patch({ rows: spec.rows.map((x, k) => (k === i ? { ...x, color: c } : x)) })} />}
                <input className="chart-input grow" data-testid="chart-row-label" placeholder={tNow('chart.label')} value={r.label} onChange={(e) => patch({ rows: spec.rows.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
                {spec.series.map((_, k) => (
                  <NumInput
                    key={k}
                    className="chart-input num"
                    data-testid="chart-row-value"
                    aria-label={tNow('chart.value')}
                    value={r.values[k] ?? 0}
                    onValue={(n) => patch({ rows: spec.rows.map((x, j) => (j === i ? { ...x, values: x.values.map((v, m) => (m === k ? n : v)) } : x)) })}
                  />
                ))}
                <button type="button" className="chart-x" aria-label={tNow('chart.remove')} onClick={() => patch({ rows: spec.rows.filter((_, k) => k !== i) })}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="chart-add" data-testid="chart-add-row" onClick={() => patch({ rows: [...spec.rows, { label: `${tNow('chart.sample.item')} ${spec.rows.length + 1}`, values: spec.series.map(() => 10), ...(rowColors ? { color: PALETTE[spec.rows.length % PALETTE.length]! } : {}) }] })}>
              + {tNow('chart.addRow')}
            </button>
          </div>
        </>
      )}

      {usesPoints(spec.type) && (
        <div className="chart-rows">
          <div className="chart-options">
            {spec.type === 'plane' && (
              <label className="chart-check">
                <input type="checkbox" data-testid="chart-z" checked={spec.z} onChange={(e) => patch({ z: e.target.checked })} /> {tNow('chart.zAxis')}
              </label>
            )}
            <label className="chart-check">
              <input type="checkbox" data-testid="chart-connect" checked={spec.connect} onChange={(e) => patch({ connect: e.target.checked })} /> {tNow('chart.connect')}
            </label>
          </div>
          {spec.points.map((p, i) => (
            <div key={i} className={`chart-row${pointDrag.over === i ? ' over' : ''}`} data-testid="chart-point" {...pointDrag.row(i)}>
              <span className="chart-handle" title={tNow('chart.dragHint')} {...pointDrag.handle(i)}>
                ⋮⋮
              </span>
              <ColorButton value={p.color ?? PALETTE[spec.type === 'plane' ? 3 : 0]} testid="chart-point-color" onChange={(c) => patch({ points: spec.points.map((x, k) => (k === i ? { ...x, color: c } : x)) })} />
              <input className="chart-input grow" placeholder={tNow('chart.label')} value={p.label} onChange={(e) => patch({ points: spec.points.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              {(['x', 'y', ...(spec.type === 'plane' && spec.z ? ['z'] : [])] as ('x' | 'y' | 'z')[]).map((ax) => (
                <label key={ax} className="chart-axis-input">
                  <span>{ax}</span>
                  <NumInput
                    className="chart-input num"
                    data-testid={`chart-point-${ax}`}
                    value={p[ax] ?? 0}
                    onValue={(n) => patch({ points: spec.points.map((x, k) => (k === i ? { ...x, [ax]: n } : x)) })}
                  />
                </label>
              ))}
              <button type="button" className="chart-x" aria-label={tNow('chart.remove')} onClick={() => patch({ points: spec.points.filter((_, k) => k !== i) })}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className="chart-add" data-testid="chart-add-point" onClick={() => patch({ points: [...spec.points, { label: String.fromCharCode(65 + (spec.points.length % 26)), x: spec.points.length, y: 1, ...(spec.z ? { z: 0 } : {}) }] })}>
            + {tNow('chart.addPoint')}
          </button>
        </div>
      )}

      {spec.type === 'flow' && (
        <div className="chart-rows">
          <div className="chart-options">
            <label className="chart-check">
              <input type="checkbox" data-testid="chart-direction" checked={spec.direction === 'TB'} onChange={(e) => patch({ direction: e.target.checked ? 'TB' : 'LR' })} /> {tNow('chart.vertical')}
            </label>
          </div>
          {spec.nodes.map((n, i) => (
            <div key={n.id} className={`chart-row${nodeDrag.over === i ? ' over' : ''}`} data-testid="chart-node" {...nodeDrag.row(i)}>
              <span className="chart-handle" title={tNow('chart.dragHint')} {...nodeDrag.handle(i)}>
                ⋮⋮
              </span>
              <ColorButton value={n.color ?? PALETTE[i % PALETTE.length]!} testid="chart-node-color" onChange={(c) => patch({ nodes: spec.nodes.map((x, k) => (k === i ? { ...x, color: c } : x)) })} />
              <input className="chart-input grow" placeholder={tNow('chart.label')} value={n.label} onChange={(e) => patch({ nodes: spec.nodes.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              <select className="chart-input" aria-label={tNow('chart.shape')} value={n.shape} onChange={(e) => patch({ nodes: spec.nodes.map((x, k) => (k === i ? { ...x, shape: e.target.value as (typeof FLOW_SHAPES)[number] } : x)) })}>
                {FLOW_SHAPES.map((s) => (
                  <option key={s} value={s}>
                    {tNow(`chart.shape.${s}` as MessageKey)}
                  </option>
                ))}
              </select>
              <button type="button" className="chart-x" aria-label={tNow('chart.remove')} onClick={() => patch({ nodes: spec.nodes.filter((_, k) => k !== i), edges: spec.edges.filter((e) => e.from !== n.id && e.to !== n.id) })}>
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="chart-add"
            data-testid="chart-add-node"
            onClick={() => {
              const id = newId()
              const last = spec.nodes[spec.nodes.length - 1]
              // yeni adım sondaki adıma bağlı gelir
              patch({ nodes: [...spec.nodes, { id, label: `${tNow('chart.sample.node')} ${spec.nodes.length + 1}`, shape: 'box' }], edges: last ? [...spec.edges, { from: last.id, to: id }] : spec.edges })
            }}
          >
            + {tNow('chart.addNode')}
          </button>
          <div className="chart-subhead">{tNow('chart.edges')}</div>
          {spec.edges.map((e, i) => (
            <div key={i} className="chart-row" data-testid="chart-edge">
              <select className="chart-input" aria-label={tNow('chart.from')} value={e.from} onChange={(ev) => patch({ edges: spec.edges.map((x, k) => (k === i ? { ...x, from: ev.target.value } : x)) })}>
                {spec.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label || n.id}
                  </option>
                ))}
              </select>
              <span className="chart-arrow">→</span>
              <select className="chart-input" aria-label={tNow('chart.to')} value={e.to} onChange={(ev) => patch({ edges: spec.edges.map((x, k) => (k === i ? { ...x, to: ev.target.value } : x)) })}>
                {spec.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label || n.id}
                  </option>
                ))}
              </select>
              <input className="chart-input grow" placeholder={tNow('chart.edgeLabel')} value={e.label ?? ''} onChange={(ev) => patch({ edges: spec.edges.map((x, k) => (k === i ? { ...x, label: ev.target.value || undefined } : x)) })} />
              <button type="button" className="chart-x" aria-label={tNow('chart.remove')} onClick={() => patch({ edges: spec.edges.filter((_, k) => k !== i) })}>
                ×
              </button>
            </div>
          ))}
          {spec.nodes.length >= 2 && (
            <button type="button" className="chart-add" data-testid="chart-add-edge" onClick={() => patch({ edges: [...spec.edges, { from: spec.nodes[0]!.id, to: spec.nodes[spec.nodes.length - 1]!.id }] })}>
              + {tNow('chart.addEdge')}
            </button>
          )}
        </div>
      )}

      <div className="chart-footer">
        <span className="chart-hint">{usesRows(spec.type) && spec.type !== 'radar' && spec.type !== 'line' && spec.type !== 'area' ? tNow('chart.dragChartHint') : spec.type === 'plane' && spec.z ? tNow('chart.rotateHint') : ''}</span>
        <button type="button" className="btn small primary" data-testid="chart-done" onClick={onDone}>
          {tNow('chart.done')}
        </button>
      </div>
    </div>
  )
}

/** Grafikte sürükle-bırak (sütun / çubuk / dilim) ve 3B düzlemde döndürme */
function ChartCanvas({ spec, onReorder }: { spec: ChartSpec; onReorder(from: number, to: number): void }) {
  const [view, setView] = useState({ yaw: 0.7, pitch: 0.45 })
  const svg = useMemo(() => renderChart(spec, view), [spec, view])
  const drag = useRef<{ row: number | null; x: number; y: number; view: typeof view } | null>(null)
  const reorderable = spec.type === 'bar' || spec.type === 'hbar' || isPieLike(spec.type)
  const rotatable = spec.type === 'plane' && spec.z
  const rowAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-row]')
    return el ? Number(el.getAttribute('data-row')) : null
  }
  return (
    <div
      className={`chart-canvas${reorderable ? ' reorderable' : ''}${rotatable ? ' rotatable' : ''}`}
      data-testid="chart-canvas"
      onMouseDown={(e) => {
        const row = reorderable ? rowAt(e.clientX, e.clientY) : null
        if (row === null && !rotatable) return
        e.preventDefault()
        drag.current = { row, x: e.clientX, y: e.clientY, view }
        const onMove = (ev: MouseEvent) => {
          if (!drag.current) return
          if (rotatable && drag.current.row === null) {
            const d = drag.current
            setView({ yaw: d.view.yaw + (ev.clientX - d.x) / 120, pitch: Math.max(0.05, Math.min(1.45, d.view.pitch + (ev.clientY - d.y) / 160)) })
          }
        }
        const onUp = (ev: MouseEvent) => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          const d = drag.current
          drag.current = null
          if (d?.row == null) return
          const to = rowAt(ev.clientX, ev.clientY)
          if (to !== null && to !== d.row) onReorder(d.row, to)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/** ```chart kod bloğunun görünümü: grafik + düzenleme paneli (bozuk veri CodeBlockView'da kod olarak kalır) */
export function ChartBlockView({ spec, editor, getPos, children }: Pick<NodeViewProps, 'editor' | 'getPos'> & { spec: ChartSpec; children: React.ReactNode }) {
  const [editing, setEditing] = useState(() => {
    if (!chartFocus.pending) return false
    chartFocus.pending = false
    return true
  })
  const editable = editor.isEditable

  // grafik verisi değişince kod bloğunun metni yenilenir (geri al çalışır)
  const set = (next: ChartSpec) => {
    const pos = typeof getPos === 'function' ? getPos() : undefined
    if (pos === undefined) return
    const text = serializeChart(next)
    const { state } = editor
    const current = state.doc.nodeAt(pos)
    if (!current) return
    editor.view.dispatch(state.tr.replaceWith(pos + 1, pos + current.nodeSize - 1, state.schema.text(text)))
  }

  return (
    <div className="chart-block" data-testid="chart-block">
      <div className="chart-frame" contentEditable={false}>
        <ChartCanvas spec={spec} onReorder={(a, b) => editable && set({ ...spec, rows: usesRows(spec.type) ? move(spec.rows, a, b) : spec.rows })} />
        {editable && !editing && (
          <button type="button" className="chart-edit glass-btn" data-testid="chart-edit" onClick={() => setEditing(true)}>
            {tNow('chart.edit')}
          </button>
        )}
      </div>
      {editable && editing && (
        <ChartEditor
          spec={spec}
          set={set}
          onDone={() => {
            setEditing(false)
            // imleç grafiğin altındaki satıra döner (yoksa boş paragraf açılır)
            const pos = typeof getPos === 'function' ? getPos() : undefined
            const node = pos !== undefined ? editor.state.doc.nodeAt(pos) : null
            if (pos === undefined || !node) return
            const after = pos + node.nodeSize
            const next = editor.state.doc.nodeAt(after)
            if (next?.type.name === 'paragraph') editor.chain().focus().setTextSelection(after + 1).run()
            else editor.chain().focus().insertContentAt(after, { type: 'paragraph' }).setTextSelection(after + 1).run()
          }}
        />
      )}
      <div style={{ display: 'none' }}>{children}</div>
    </div>
  )
}

/** Baskı / salt okunur: yalnızca grafik */
export function StaticChart({ spec }: { spec: ChartSpec }) {
  return <div className="chart-canvas" dangerouslySetInnerHTML={{ __html: renderChart(spec) }} />
}
