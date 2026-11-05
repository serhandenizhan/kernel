import { useEffect, useRef, useState } from 'react'
import type { SearchHit } from '@shared/types'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { PageIcon } from './PageHeader'
import { tNow } from '../lib/i18n'
import { Icon } from '../assets/icons'

interface Row {
  id: string
  title: string
  path: string
  snippet?: string
  icon?: string
}

// Cmd+K: sayfa adı ve tam metin arama (cam palet)
export function SearchPalette() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [index, setIndex] = useState(0)
  const seq = useRef(0)
  const close = () => useStore.getState().setOverlay(null)

  useEffect(() => {
    const my = ++seq.current
    const run = async () => {
      const res: Row[] = q.trim() ? (await kernel.search.query(q, 20)).map((h: SearchHit) => ({ id: h.id, title: h.title, path: h.path, snippet: h.snippet })) : await kernel.search.recent()
      if (my === seq.current) {
        setRows(res)
        setIndex(0)
      }
    }
    void run()
  }, [q])

  const open = (row: Row | undefined) => {
    if (!row) return
    useStore.getState().openPage(row.id)
    close()
  }

  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={close}>
      <div className="palette glass" onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="palette-input"
          data-testid="search-input"
          autoFocus
          placeholder={tNow('search.placeholder')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(rows.length - 1, i + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') open(rows[index])
          }}
        />
        <div className="palette-section">{q.trim() ? tNow('search.results') : tNow('search.recent')}</div>
        <div className="palette-list">
          {rows.map((r, i) => (
            <button key={r.id} data-testid="search-result" className={`palette-row${i === index ? ' active' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => open(r)}>
              <span className="palette-icon">{r.icon ? <PageIcon icon={r.icon} size={16} /> : <Icon name="doc" size={14} />}</span>
              <span className="palette-text">
                <span className="palette-title">{r.title}</span>
                {r.snippet && <span className="palette-snippet">{r.snippet}</span>}
                <span className="palette-path">{r.path.replace(/\.md$/, '')}</span>
              </span>
            </button>
          ))}
          {!rows.length && <div className="palette-empty">{q.trim() ? tNow('search.noResults') : tNow('search.noRecent')}</div>}
        </div>
      </div>
    </div>
  )
}
