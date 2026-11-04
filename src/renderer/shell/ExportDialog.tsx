import { useEffect, useState } from 'react'
import type { PdfOptions } from '@shared/types'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { activeEditor } from '../editor/Editor'

const DEFAULTS: PdfOptions = { pageSize: 'A4', margin: 'normal', showCover: true, pageNumbers: true, includeSubpages: false, theme: 'light' }

// PDF export penceresi (Cmd+E)
export function ExportDialog() {
  const currentId = useStore((s) => s.currentId)
  const [opts, setOpts] = useState<PdfOptions>(DEFAULTS)
  const [format, setFormat] = useState<'pdf' | 'html' | 'markdown'>('pdf')
  const [busy, setBusy] = useState(false)
  const close = () => useStore.getState().setOverlay(null)
  const set = <K extends keyof PdfOptions>(k: K, v: PdfOptions[K]) => setOpts((o) => ({ ...o, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy])

  const run = async () => {
    if (!currentId) return
    setBusy(true)
    try {
      await activeEditor.flush?.() // son değişiklikler PDF'e girsin
      const res =
        format === 'pdf' ? await kernel.pdf.export(currentId, opts) : format === 'html' ? await kernel.exportAs.html(currentId, opts) : await kernel.exportAs.markdown(currentId, opts.includeSubpages)
      if ('filePath' in res) {
        const kind = format === 'pdf' ? 'PDF' : format === 'html' ? 'HTML' : 'Markdown'
        useStore.getState().toast(`${kind} kaydedildi: ${res.filePath.split('/').pop()}`)
        window.dispatchEvent(new CustomEvent('kernel:tip', { detail: 'first-export' }))
      }
      close()
    } catch (e) {
      useStore.getState().toast(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : 'PDF oluşturulamadı', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && close()}>
      <div className="modal export glass" role="dialog" aria-label="Dışa aktar" data-testid="export-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Dışa aktar</h3>
        <label className="setting-row">
          <span>Biçim</span>
          <select data-testid="export-format" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <option value="pdf">PDF</option>
            <option value="html">HTML (tek dosya)</option>
            <option value="markdown">Markdown (zip)</option>
          </select>
        </label>
        <label className="setting-row">
          <span>Kâğıt</span>
          <select data-testid="pdf-pageSize" value={opts.pageSize} onChange={(e) => set('pageSize', e.target.value as PdfOptions['pageSize'])}>
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
        </label>
        <label className="setting-row">
          <span>Kenar boşluğu</span>
          <select data-testid="pdf-margin" value={opts.margin} onChange={(e) => set('margin', e.target.value as PdfOptions['margin'])}>
            <option value="narrow">Dar</option>
            <option value="normal">Normal</option>
            <option value="wide">Geniş</option>
          </select>
        </label>
        <label className="setting-row">
          <span>Tema</span>
          <select data-testid="pdf-theme" value={opts.theme} onChange={(e) => set('theme', e.target.value as PdfOptions['theme'])}>
            <option value="light">Açık</option>
            <option value="dark">Koyu</option>
          </select>
        </label>
        <label className="setting-check">
          <input type="checkbox" data-testid="pdf-showCover" checked={opts.showCover} onChange={(e) => set('showCover', e.target.checked)} />
          Kapağı ilk sayfada göster
        </label>
        <label className="setting-check">
          <input type="checkbox" data-testid="pdf-pageNumbers" checked={opts.pageNumbers} onChange={(e) => set('pageNumbers', e.target.checked)} />
          Sayfa numarası
        </label>
        <label className="setting-check">
          <input type="checkbox" data-testid="pdf-includeSubpages" checked={opts.includeSubpages} onChange={(e) => set('includeSubpages', e.target.checked)} />
          Alt sayfaları da ekle (tek PDF)
        </label>
        <div className="modal-actions">
          <button className="btn" onClick={close} disabled={busy}>
            Vazgeç
          </button>
          <button className="btn primary" data-testid="pdf-export" onClick={() => void run()} disabled={busy}>
            {busy ? 'Hazırlanıyor…' : 'Dışa aktar'}
          </button>
        </div>
      </div>
    </div>
  )
}
