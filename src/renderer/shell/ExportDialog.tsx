import { useEffect, useState } from 'react'
import type { PdfOptions } from '@shared/types'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { activeEditor } from '../editor/Editor'
import { useT } from '../lib/i18n'

const DEFAULTS: PdfOptions = { pageSize: 'A4', margin: 'normal', showCover: true, pageNumbers: true, includeSubpages: false, theme: 'light' }

// PDF export penceresi (Cmd+E)
export function ExportDialog() {
  const currentId = useStore((s) => s.currentId)
  const [opts, setOpts] = useState<PdfOptions>(DEFAULTS)
  const [format, setFormat] = useState<'pdf' | 'html' | 'markdown'>('pdf')
  const [busy, setBusy] = useState(false)
  const close = () => useStore.getState().setOverlay(null)
  const t = useT()
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
        useStore.getState().toast(t('export.saved', { kind, name: res.filePath.split('/').pop() ?? '' }))
        window.dispatchEvent(new CustomEvent('kernel:tip', { detail: 'first-export' }))
      }
      close()
    } catch (e) {
      useStore.getState().toast(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : t('export.failed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={() => !busy && close()}>
      <div className="modal export glass" role="dialog" aria-label={t('export.title')} data-testid="export-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{t('export.title')}</h3>
        <label className="setting-row">
          <span>{t('export.format')}</span>
          <select data-testid="export-format" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
            <option value="pdf">PDF</option>
            <option value="html">{t('export.format.html')}</option>
            <option value="markdown">{t('export.format.markdown')}</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{t('export.paper')}</span>
          <select data-testid="pdf-pageSize" value={opts.pageSize} onChange={(e) => set('pageSize', e.target.value as PdfOptions['pageSize'])}>
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{t('export.margin')}</span>
          <select data-testid="pdf-margin" value={opts.margin} onChange={(e) => set('margin', e.target.value as PdfOptions['margin'])}>
            <option value="narrow">{t('export.margin.narrow')}</option>
            <option value="normal">{t('export.margin.normal')}</option>
            <option value="wide">{t('export.margin.wide')}</option>
          </select>
        </label>
        <label className="setting-row">
          <span>{t('export.theme')}</span>
          <select data-testid="pdf-theme" value={opts.theme} onChange={(e) => set('theme', e.target.value as PdfOptions['theme'])}>
            <option value="light">{t('export.theme.light')}</option>
            <option value="dark">{t('export.theme.dark')}</option>
          </select>
        </label>
        <label className="setting-check">
          <input type="checkbox" data-testid="pdf-showCover" checked={opts.showCover} onChange={(e) => set('showCover', e.target.checked)} />
          {t('export.cover')}
        </label>
        <label className="setting-check">
          <input type="checkbox" data-testid="pdf-pageNumbers" checked={opts.pageNumbers} onChange={(e) => set('pageNumbers', e.target.checked)} />
          {t('export.pageNumbers')}
        </label>
        <label className="setting-check">
          <input type="checkbox" data-testid="pdf-includeSubpages" checked={opts.includeSubpages} onChange={(e) => set('includeSubpages', e.target.checked)} />
          {t('export.subpages')}
        </label>
        <div className="modal-actions">
          <button className="btn" onClick={close} disabled={busy}>
            {t('export.cancel')}
          </button>
          <button className="btn primary" data-testid="pdf-export" onClick={() => void run()} disabled={busy}>
            {busy ? t('export.preparing') : t('export.title')}
          </button>
        </div>
      </div>
    </div>
  )
}
