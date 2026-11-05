import { useEffect, useMemo, useState } from 'react'
import { diffLines } from 'diff'
import type { HistoryEntry } from '@shared/types'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { activeEditor } from '../editor/Editor'
import { useLang, useT } from '../lib/i18n'
import { formatRelative } from '@shared/i18n'


// Sürüm geçmişi: solda sürümler, sağda mevcut sayfayla yan yana fark, "Bu sürümü geri yükle"
export function HistoryPanel() {
  const t = useT()
  const lang = useLang()
  const currentId = useStore((s) => s.currentId)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [oldText, setOldText] = useState('')
  const [curText, setCurText] = useState('')
  const [busy, setBusy] = useState(false)
  const close = () => useStore.getState().setOverlay(null)

  useEffect(() => {
    if (!currentId) return
    void (async () => {
      await activeEditor.flush?.()
      const [list, page] = await Promise.all([kernel.history.list(currentId), kernel.pages.read(currentId)])
      setEntries(list)
      setCurText(page.markdown)
      setSelected(list[0]?.versionId ?? null)
    })()
    window.dispatchEvent(new CustomEvent('kernel:tip', { detail: 'first-history' }))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentId])

  useEffect(() => {
    if (!currentId || !selected) return
    void kernel.history.read(currentId, selected).then(setOldText)
  }, [currentId, selected])

  const parts = useMemo(() => diffLines(oldText, curText), [oldText, curText])

  const restore = async () => {
    if (!currentId || !selected) return
    setBusy(true)
    try {
      await activeEditor.flush?.()
      await kernel.history.restore(currentId, selected)
      close()
      useStore.getState().reloadPage()
      useStore.getState().toast(t('history.restored'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="history-panel glass" data-testid="history-panel" role="dialog" aria-label={t('tree.history')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="history-list">
          <h3>{t('tree.history')}</h3>
          {entries.length === 0 && <div className="toc-empty">{t('history.empty')}</div>}
          {entries.map((e) => (
            <button key={e.versionId} data-testid="history-entry" className={`history-entry${selected === e.versionId ? ' active' : ''}`} onClick={() => setSelected(e.versionId)}>
              {formatRelative(new Date(e.time), new Date(), lang)}
            </button>
          ))}
        </div>
        <div className="history-main">
          <div className="history-legend">
            <span className="del">{t('history.removed')}</span>
            <span className="add">{t('history.added')}</span>
          </div>
          <div className="history-diff" data-testid="history-diff">
            {parts.map((p, i) => (
              <pre key={i} className={p.added ? 'add' : p.removed ? 'del' : 'same'}>
                {p.value}
              </pre>
            ))}
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={close}>
              {t('history.close')}
            </button>
            <button className="btn primary" data-testid="history-restore" disabled={!selected || busy} onClick={() => void restore()}>
              {t('history.restore')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
