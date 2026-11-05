import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { useSlash } from './slash-state'
import { tNow } from '../../lib/i18n'

// "/" blok menüsü (cam yüzey)
export function SlashMenu() {
  const { open, items, index, rect, choose } = useSlash()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open || !rect) return null
  const top = rect.bottom + 6 + 320 > window.innerHeight ? Math.max(8, rect.top - 326) : rect.bottom + 6
  // body'ye çizilir: sayfa yüzeyinin cam efekti (backdrop-filter) sabit konumlu menüleri kaydırmasın
  return createPortal(
    <div className="slash-menu glass glass-pop" data-testid="slash-menu" style={{ left: rect.left, top }} onMouseDown={(e) => e.preventDefault()}>
      {items.length === 0 ? (
        <div className="slash-empty">{tNow('slash.noMatch')}</div>
      ) : (
        <div ref={listRef} className="slash-list">
          {items.map((it, i) => (
            <button
              key={it.id}
              data-index={i}
              data-testid="slash-item"
              className={`slash-item${i === index ? ' active' : ''}`}
              onMouseEnter={() => useSlash.setState({ index: i })}
              onClick={() => choose(i)}
            >
              <span className="slash-icon">{it.icon}</span>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
