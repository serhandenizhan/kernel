import { useEffect, useRef, useState } from 'react'
import { activeEditor } from '../Editor'
import { findKey, findState } from '../nodes/FindHighlight'
import { useStore } from '../../state/store'
import { useT } from '../../lib/i18n'

// Sayfa içi arama çubuğu (⌘F / Ctrl+F): Enter sonraki, Shift+Enter önceki, Esc kapatır
export function FindBar() {
  const t = useT()
  const open = useStore((s) => s.findOpen)
  const nonce = useStore((s) => s.findNonce)
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [count, setCount] = useState({ current: 0, total: 0 })

  const apply = (q: string, current: number, reveal: boolean) => {
    const ed = activeEditor.editor
    if (!ed || ed.isDestroyed) return
    ed.view.dispatch(ed.state.tr.setMeta(findKey, { query: q, current }).setMeta('addToHistory', false))
    const st = findState(ed.state)
    const total = st?.matches.length ?? 0
    setCount({ current: total ? (st!.current + 1) : 0, total })
    if (reveal && total) {
      // geçerli eşleşmeyi görünür alana getir (odak arama kutusunda kalır)
      requestAnimationFrame(() => ed.view.dom.querySelector('.find-current')?.scrollIntoView({ block: 'center' }))
    }
  }

  // açılınca (ya da açıkken ⌘F'ye yeniden basılınca): seçili metinle doldur, kutuyu seç
  useEffect(() => {
    if (!open) return
    const ed = activeEditor.editor
    const sel = ed && !ed.state.selection.empty ? ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, ' ').slice(0, 200) : ''
    const q = sel && !sel.includes('\n') ? sel : query
    setQuery(q)
    apply(q, 0, true)
    requestAnimationFrame(() => input.current?.select())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nonce])

  // başka sayfaya geçince kapanır
  const currentId = useStore((s) => s.currentId)
  useEffect(() => {
    useStore.getState().setFindOpen(false)
  }, [currentId])

  // kapanınca vurguları temizle
  useEffect(() => {
    if (open) return
    const ed = activeEditor.editor
    if (ed && !ed.isDestroyed && findState(ed.state)?.query) ed.view.dispatch(ed.state.tr.setMeta(findKey, { query: '', current: 0 }).setMeta('addToHistory', false))
  }, [open])

  if (!open) return null
  const close = () => {
    useStore.getState().setFindOpen(false)
    activeEditor.editor?.commands.focus()
  }
  const step = (d: number) => {
    const st = activeEditor.editor ? findState(activeEditor.editor.state) : undefined
    if (!st || !st.matches.length) return
    apply(query, (st.current + d + st.matches.length) % st.matches.length, true)
  }
  return (
    <div className="find-bar glass glass-pop" data-testid="find-bar" role="search">
      <input
        ref={input}
        data-testid="find-input"
        value={query}
        placeholder={t('find.placeholder')}
        aria-label={t('find.placeholder')}
        onChange={(e) => {
          setQuery(e.target.value)
          apply(e.target.value, 0, true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            step(e.shiftKey ? -1 : 1)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            close()
          }
        }}
      />
      <span className="find-count" data-testid="find-count">
        {count.current}/{count.total}
      </span>
      <button className="icon-btn" title={t('find.prev')} aria-label={t('find.prev')} onClick={() => step(-1)}>
        ↑
      </button>
      <button className="icon-btn" title={t('find.next')} aria-label={t('find.next')} onClick={() => step(1)}>
        ↓
      </button>
      <button className="icon-btn" title={t('find.close')} aria-label={t('find.close')} onClick={close}>
        ×
      </button>
    </div>
  )
}
