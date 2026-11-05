import { useEffect, useMemo, useRef, useState } from 'react'
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import type { GraphData } from '@shared/types'
import { folderColorIndex, localGraph } from '@core/graph'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { useT } from '../lib/i18n'

interface SimNode extends SimulationNodeDatum {
  id: string
  title: string
  folder: string
  degree: number
}
type SimLink = SimulationLinkDatum<SimNode>

const COLORS = 6
const radius = (n: SimNode) => 4 + Math.sqrt(n.degree) * 1.6

// Graf görünümü (spec §12): genel graf ya da bir sayfanın yerel grafı; klasöre göre renk, tıklayınca sayfa
export function GraphView() {
  const t = useT()
  const focus = useStore((s) => s.graphFocus)
  const currentId = useStore((s) => s.currentId)
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => void kernel.links.graph().then((g) => alive && setData(g))
    load()
    const off = kernel.events.onLinksChanged(load)
    return () => {
      alive = false
      off()
    }
  }, [])

  const shown = useMemo(() => (focus ? localGraph(data, focus) : data), [data, focus])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const css = getComputedStyle(document.documentElement)
    const palette = Array.from({ length: COLORS }, (_, i) => css.getPropertyValue(`--graph-${i}`).trim() || '#888')
    const lineColor = css.getPropertyValue('--border-strong').trim()
    const textColor = css.getPropertyValue('--text-2').trim()
    const accent = css.getPropertyValue('--accent').trim()
    const colorOf = folderColorIndex(shown.nodes, COLORS)

    const degree = new Map<string, number>()
    for (const l of shown.links) {
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1)
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1)
    }
    const nodes: SimNode[] = shown.nodes.map((n) => ({ id: n.id, title: n.title, folder: n.folder, degree: degree.get(n.id) ?? 0 }))
    const links: SimLink[] = shown.links.map((l) => ({ source: l.source, target: l.target }))

    // görünüm dönüşümü: kaydırma + yakınlaştırma
    const view = { x: 0, y: 0, k: 1 }
    let hovered: SimNode | null = null
    const size = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = r.width * dpr
      canvas.height = r.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      return r
    }
    let rect = size()

    const draw = () => {
      ctx.clearRect(0, 0, rect.width, rect.height)
      ctx.save()
      ctx.translate(rect.width / 2 + view.x, rect.height / 2 + view.y)
      ctx.scale(view.k, view.k)
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1 / view.k
      ctx.beginPath()
      for (const l of links) {
        const s = l.source as SimNode
        const d = l.target as SimNode
        ctx.moveTo(s.x ?? 0, s.y ?? 0)
        ctx.lineTo(d.x ?? 0, d.y ?? 0)
      }
      ctx.stroke()
      const showAll = nodes.length <= 60 || view.k > 1.6
      ctx.font = `${12 / view.k}px -apple-system, system-ui, sans-serif`
      ctx.textAlign = 'center'
      for (const n of nodes) {
        const r = radius(n)
        ctx.beginPath()
        ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, Math.PI * 2)
        ctx.fillStyle = n.id === focus ? accent : palette[colorOf.get(n.folder) ?? 0]!
        ctx.fill()
        if (showAll || n === hovered || n.id === focus) {
          ctx.fillStyle = textColor
          ctx.fillText(n.title, n.x ?? 0, (n.y ?? 0) + r + 12 / view.k)
        }
      }
      ctx.restore()
    }

    const sim = forceSimulation(nodes)
      // etiketler düğümün altında yazılır: düğümler etiketler çakışmayacak kadar aralıklı dursun
      .force('link', forceLink<SimNode, SimLink>(links).id((n) => n.id).distance(110))
      .force('charge', forceManyBody().strength(-320))
      .force('center', forceCenter(0, 0))
      // bağlantısız sayfalar kenarlara savrulmasın
      .force('x', forceX<SimNode>(0).strength(0.07))
      .force('y', forceY<SimNode>(0).strength(0.07))
      .force('collide', forceCollide<SimNode>((n) => radius(n) + 22))
      .on('tick', draw)

    const toWorld = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: (e.clientX - r.left - r.width / 2 - view.x) / view.k, y: (e.clientY - r.top - r.height / 2 - view.y) / view.k }
    }
    const hit = (e: MouseEvent) => {
      const p = toWorld(e)
      return nodes.find((n) => Math.hypot((n.x ?? 0) - p.x, (n.y ?? 0) - p.y) <= radius(n) + 3) ?? null
    }
    let drag: { x: number; y: number; moved: boolean } | null = null
    const onDown = (e: MouseEvent) => (drag = { x: e.clientX, y: e.clientY, moved: false })
    const onMove = (e: MouseEvent) => {
      if (drag) {
        const dx = e.clientX - drag.x
        const dy = e.clientY - drag.y
        if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true
        view.x += dx
        view.y += dy
        drag.x = e.clientX
        drag.y = e.clientY
        draw()
        return
      }
      const h = hit(e)
      if (h !== hovered) {
        hovered = h
        canvas.style.cursor = h ? 'pointer' : 'grab'
        setHover(h?.title ?? null)
        draw()
      }
    }
    const onUp = (e: MouseEvent) => {
      const wasDrag = drag?.moved
      drag = null
      if (wasDrag) return
      const h = hit(e)
      if (h) useStore.getState().openPage(h.id)
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      view.k = Math.min(4, Math.max(0.25, view.k * Math.exp(-e.deltaY * 0.002)))
      draw()
    }
    const onResize = () => {
      rect = size()
      draw()
    }
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', onResize)
    return () => {
      sim.stop()
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onResize)
    }
  }, [shown, focus])

  const openGraph = useStore.getState().openGraph
  return (
    <section className="graph-view" data-testid="graph-view">
      <header className="graph-bar">
        <div className="segmented graph-modes" role="group">
          <button className={`segment${focus ? '' : ' on'}`} data-testid="graph-global" onClick={() => openGraph(null)}>
            {t('graph.global')}
          </button>
          <button className={`segment${focus ? ' on' : ''}`} data-testid="graph-local" disabled={!currentId} onClick={() => currentId && openGraph(currentId)}>
            {t('graph.local')}
          </button>
        </div>
        <span className="graph-stats" data-testid="graph-stats">
          {t('graph.stats', { pages: shown.nodes.length, links: shown.links.length })}
        </span>
        {hover && <span className="graph-hover">{hover}</span>}
      </header>
      {shown.nodes.length === 0 ? <p className="graph-empty">{t('graph.empty')}</p> : <canvas ref={canvasRef} className="graph-canvas" aria-hidden="true" />}
      {/* ekran okuyucu ve klavye için aynı düğümler liste olarak */}
      <ul className="sr-only" aria-label={t('graph.title')}>
        {shown.nodes.map((n) => (
          <li key={n.id}>
            <button data-testid="graph-node" onClick={() => useStore.getState().openPage(n.id)}>
              {n.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
