import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '../assets/icons'

export interface MenuItem {
  label: string
  onSelect(): void
  danger?: boolean
  separatorBefore?: boolean
  /** soldaki ikon */
  icon?: IconName
  /** sağda soluk kısayol / açıklama */
  hint?: string
  /** soldaki renk örneği (vurgu rengi menüsü) */
  swatch?: string
  /** üzerine gelince yana açılan alt menü (onSelect çağrılmaz) */
  submenu?: MenuItem[]
  /** seçili durumu gösterir (onay işareti) */
  checked?: boolean
}

function Items({ items, onClose }: { items: MenuItem[]; onClose(): void }) {
  const [openSub, setOpenSub] = useState<number | null>(null)
  return (
    <>
      {items.map((it, i) => (
        <div key={it.label} className="menu-row" onMouseEnter={() => setOpenSub(it.submenu ? i : null)}>
          {it.separatorBefore && <div className="menu-sep" />}
          <button
            className={`menu-item${it.danger ? ' danger' : ''}${openSub === i ? ' open' : ''}`}
            role="menuitem"
            aria-haspopup={it.submenu ? 'menu' : undefined}
            aria-expanded={it.submenu ? openSub === i : undefined}
            onClick={() => {
              if (it.submenu) {
                setOpenSub(openSub === i ? null : i)
                return
              }
              onClose()
              it.onSelect()
            }}
          >
            {it.swatch ? <span className="menu-swatch" style={{ background: it.swatch }} /> : it.icon ? <Icon name={it.icon} size={15} /> : null}
            <span className="menu-label">{it.label}</span>
            {it.checked && <span className="menu-check">✓</span>}
            {it.hint && <span className="menu-hint">{it.hint}</span>}
            {it.submenu && <Icon name="chevron-right" size={12} />}
          </button>
          {it.submenu && openSub === i && (
            <div className="menu submenu glass glass-pop" role="menu">
              <Items items={it.submenu} onClose={onClose} />
            </div>
          )}
        </div>
      ))}
    </>
  )
}

// Cam yüzeyli sağ tık menüsü: ikon, kısayol ipucu, başlık satırı ve yana açılan alt menü destekler
export function ContextMenu({ x, y, items, header, onClose }: { x: number; y: number; items: MenuItem[]; header?: string; onClose(): void }) {
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
      {header && (
        <div className="menu-header" data-testid="menu-header">
          {header}
        </div>
      )}
      <Items items={items} onClose={onClose} />
    </div>,
    document.body
  )
}
