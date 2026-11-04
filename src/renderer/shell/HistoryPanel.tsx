import { useEffect, useMemo, useState } from 'react'
import { diffLines } from 'diff'
import type { HistoryEntry } from '@shared/types'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { activeEditor } from '../editor/Editor'

function relTime(iso: string): string {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'az önce'
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`
  if (s < 86400) return `${Math.floor(s / 3600)} saat önce`
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Sürüm geçmişi: solda sürümler, sağda mevcut sayfayla yan yana fark, "Bu sürümü geri yükle"
export function HistoryPanel() {
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
      useStore.getState().toast('Sürüm geri yüklendi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="history-panel glass" data-testid="history-panel" role="dialog" aria-label="Sürüm geçmişi" onMouseDown={(e) => e.stopPropagation()}>
        <div className="history-list">
          <h3>Sürüm geçmişi</h3>
          {entries.length === 0 && <div className="toc-empty">Henüz sürüm yok. Düzenledikçe en fazla 5 dakikada bir kaydedilir.</div>}
          {entries.map((e) => (
            <button key={e.versionId} data-testid="history-entry" className={`history-entry${selected === e.versionId ? ' active' : ''}`} onClick={() => setSelected(e.versionId)}>
              {relTime(e.time)}
            </button>
          ))}
        </div>
        <div className="history-main">
          <div className="history-legend">
            <span className="del">Seçilen sürümde olup şimdi olmayan</span>
            <span className="add">Şimdi eklenmiş olan</span>
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
              Kapat
            </button>
            <button className="btn primary" data-testid="history-restore" disabled={!selected || busy} onClick={() => void restore()}>
              Bu sürümü geri yükle
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
