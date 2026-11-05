import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  onSelect(): void
  danger?: boolean
  separatorBefore?: boolean
}

// Cam yüzeyli sağ tık menüsü
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) })
  }, [x, y])

  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
    }
  }, [onClose])

  // body'ye çizilir: sayfa yüzeyinin cam efekti (backdrop-filter) sabit konumlu menüleri kaydırmasın
  return createPortal(
    <div ref={ref} className="menu glass glass-pop" role="menu" style={{ left: pos.x, top: pos.y }}>
      {items.map((it) => (
        <div key={it.label}>
          {it.separatorBefore && <div className="menu-sep" />}
          <button
            className={`menu-item${it.danger ? ' danger' : ''}`}
            role="menuitem"
            onClick={() => {
              onClose()
              it.onSelect()
            }}
          >
            {it.label}
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
