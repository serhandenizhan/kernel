import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { toVaultUrl } from '@core/vault-url'
import { loadPdf, type PDFDocumentProxy } from '../../lib/pdfjs'
import { tNow } from '../../lib/i18n'

const MIN = 0.5
const MAX = 3

/** Bir PDF sayfasını kabın genişliğine sığdırıp net (devicePixelRatio) çizer */
function PdfCanvas({ doc, page, zoom, width }: { doc: PDFDocumentProxy; page: number; zoom: number; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let task: { cancel(): void; promise: Promise<void> } | null = null
    let alive = true
    void (async () => {
      const p = await doc.getPage(page)
      if (!alive || !ref.current) return
      const base = p.getViewport({ scale: 1 })
      const scale = (width / base.width) * zoom
      const vp = p.getViewport({ scale: scale * window.devicePixelRatio })
      const c = ref.current
      c.width = Math.floor(vp.width)
      c.height = Math.floor(vp.height)
      c.style.width = `${Math.floor(vp.width / window.devicePixelRatio)}px`
      c.style.height = `${Math.floor(vp.height / window.devicePixelRatio)}px`
      const t = p.render({ canvas: c, viewport: vp } as never) as unknown as { cancel(): void; promise: Promise<void> }
      task = t
      await t.promise.catch(() => undefined)
    })()
    return () => {
      alive = false
      task?.cancel()
    }
  }, [doc, page, zoom, width])
  return <canvas ref={ref} className="pdf-canvas" />
}

function Toolbar({ name, page, pages, zoom, setPage, setZoom, onExpand }: { name: string; page: number; pages: number; zoom: number; setPage(n: number): void; setZoom(z: number): void; onExpand?(): void }) {
  return (
    <div className="pdf-toolbar" contentEditable={false}>
      <span className="pdf-name">📄 {name}</span>
      <button className="code-btn" data-testid="pdf-prev" disabled={page <= 1} onClick={() => setPage(page - 1)}>
        ◀
      </button>
      <span data-testid="pdf-page">{`${page} / ${pages}`}</span>
      <button className="code-btn" data-testid="pdf-next" disabled={page >= pages} onClick={() => setPage(page + 1)}>
        ▶
      </button>
      <button className="code-btn" onClick={() => setZoom(Math.max(MIN, Math.round((zoom - 0.25) * 100) / 100))}>
        −
      </button>
      <span>{Math.round(zoom * 100)}%</span>
      <button className="code-btn" onClick={() => setZoom(Math.min(MAX, Math.round((zoom + 0.25) * 100) / 100))}>
        +
      </button>
      {onExpand && (
        <button className="code-btn" data-testid="pdf-expand" onClick={onExpand}>
          {tNow('pdf.enlarge')}
        </button>
      )}
    </div>
  )
}

// Gömülü PDF: sayfa gezinme, yakınlaştırma, büyütülmüş görünüm. Baskıda (PDF export) dosya kartı.
export function PdfEmbedView({ node, editor }: NodeViewProps) {
  const src = String(node.attrs['src'] ?? '')
  const name = src.split('/').pop() ?? src
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [expanded, setExpanded] = useState(false)
  const [mPage, setMPage] = useState(1)
  const [mZoom, setMZoom] = useState(1)
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)

  useEffect(() => {
    if (!editor.isEditable) return
    let alive = true
    loadPdf(toVaultUrl(src))
      .then((d) => alive && setDoc(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : tNow('pdf.openFailed')))
    return () => {
      alive = false
    }
  }, [src, editor.isEditable])

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(Math.max(200, el.clientWidth - 24)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  if (!editor.isEditable) {
    return (
      <NodeViewWrapper className="pdf-card" data-testid="pdf-embed">
        📄 {name} — gömülü PDF
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="pdf-embed" data-testid="pdf-embed" data-drag-handle>
      <div ref={boxRef}>
        {doc && <Toolbar name={name} page={page} pages={doc.numPages} zoom={zoom} setPage={setPage} setZoom={setZoom} onExpand={() => (setMPage(page), setExpanded(true))} />}
        <div className="pdf-stage" contentEditable={false}>
          {error ? <div className="mermaid-error">{error}</div> : doc ? <PdfCanvas doc={doc} page={page} zoom={zoom} width={width} /> : <div className="pdf-loading">{tNow('pdf.loading')}</div>}
        </div>
      </div>
      {expanded &&
        doc &&
        createPortal(
          <div className="modal-backdrop" onMouseDown={() => setExpanded(false)}>
            <div className="pdf-modal glass" data-testid="pdf-modal" onMouseDown={(e) => e.stopPropagation()}>
              <Toolbar name={name} page={mPage} pages={doc.numPages} zoom={mZoom} setPage={setMPage} setZoom={setMZoom} />
              <div className="pdf-stage modal-stage">
                <PdfCanvas doc={doc} page={mPage} zoom={mZoom} width={Math.min(window.innerWidth - 120, 1100)} />
              </div>
            </div>
          </div>,
          document.body
        )}
    </NodeViewWrapper>
  )
}
