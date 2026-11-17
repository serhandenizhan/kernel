import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '../assets/icons'
import { moveIndex } from './menu-nav'

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

interface Nav {
  /** üst menüde seçili öğe (-1: yok) */
  top: number
  /** alt menü açık olan üst öğe (null: kapalı) */
  open: number | null
  /** alt menüde seçili öğe (-1: yok) */
  sub: number
}

function Row({ it, active, open, onEnter, onPick, children }: { it: MenuItem; active: boolean; open: boolean; onEnter(): void; onPick(): void; children?: React.ReactNode }) {
  return (
    <div className="menu-row" onMouseEnter={onEnter}>
      {it.separatorBefore && <div className="menu-sep" />}
      <button
        className={`menu-item${it.danger ? ' danger' : ''}${open ? ' open' : ''}`}
        role="menuitem"
        data-active={active ? 'true' : undefined}
        aria-haspopup={it.submenu ? 'menu' : undefined}
        aria-expanded={it.submenu ? open : undefined}
        onClick={onPick}
      >
        {it.swatch ? <span className="menu-swatch" style={{ background: it.swatch }} /> : it.icon ? <Icon name={it.icon} size={15} /> : null}
        <span className="menu-label">{it.label}</span>
        {it.checked && <span className="menu-check">✓</span>}
        {it.hint && <span className="menu-hint">{it.hint}</span>}
        {it.submenu && <Icon name="chevron-right" size={12} />}
      </button>
      {children}
    </div>
  )
}

// Cam yüzeyli sağ tık menüsü: ikon, kısayol ipucu, başlık satırı ve yana açılan alt menü destekler.
// Klavye: ↑ ↓ gezinir, → alt menüyü açar, ← kapatır, Enter seçer, Esc önce alt menüyü sonra menüyü kapatır.
export function ContextMenu({ x, y, items, header, onClose }: { x: number; y: number; items: MenuItem[]; header?: string; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  const [nav, setNav] = useState<Nav>({ top: -1, open: null, sub: -1 })
  const navRef = useRef(nav)
  navRef.current = nav

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ x: Math.min(x, window.innerWidth - r.width - 8), y: Math.min(y, window.innerHeight - r.height - 8) })
  }, [x, y])

  useEffect(() => {
    const pick = (it: MenuItem) => {
      onClose()
      it.onSelect()
    }
    const onMouse = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    // yakalama aşamasında: menü açıkken ok tuşları ve Enter editöre ulaşmaz (imleç kaymaz, satır eklenmez)
    const onKey = (e: KeyboardEvent) => {
      const n = navRef.current
      const inSub = n.open !== null && n.sub >= 0
      const list = inSub ? (items[n.open!]?.submenu ?? []) : items
      const stop = () => {
        e.preventDefault()
        e.stopPropagation()
      }
      switch (e.key) {
        case 'Escape':
          stop()
          if (n.open !== null) setNav({ ...n, open: null, sub: -1 })
          else onClose()
          break
        case 'ArrowDown':
        case 'ArrowUp': {
          stop()
          const dir = e.key === 'ArrowDown' ? 1 : -1
          if (inSub) setNav({ ...n, sub: moveIndex(list.length, n.sub, dir) })
          else setNav({ top: moveIndex(items.length, n.top, dir), open: null, sub: -1 })
          break
        }
        case 'Home':
        case 'End': {
          stop()
          const at = e.key === 'Home' ? 0 : list.length - 1
          if (inSub) setNav({ ...n, sub: at })
          else setNav({ top: at, open: null, sub: -1 })
          break
        }
        case 'ArrowRight':
          if (!inSub && n.top >= 0 && items[n.top]?.submenu) {
            stop()
            setNav({ top: n.top, open: n.top, sub: 0 })
          }
          break
        case 'ArrowLeft':
          if (n.open !== null) {
            stop()
            setNav({ top: n.top, open: null, sub: -1 })
          }
          break
        case 'Enter':
        case ' ': {
          const it = inSub ? list[n.sub] : items[n.top]
          if (!it) break
          stop()
          if (it.submenu) setNav({ top: n.top, open: n.top, sub: 0 })
          else pick(it)
          break
        }
      }
    }
    window.addEventListener('mousedown', onMouse)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onMouse)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [items, onClose])

  const pick = (it: MenuItem) => {
    onClose()
    it.onSelect()
  }
  // body'ye çizilir: sayfa yüzeyinin cam efekti (backdrop-filter) sabit konumlu menüleri kaydırmasın
  return createPortal(
    <div ref={ref} className="menu glass glass-pop" role="menu" style={{ left: pos.x, top: pos.y }}>
      {header && (
        <div className="menu-header" data-testid="menu-header">
          {header}
        </div>
      )}
      {items.map((it, i) => (
        <Row
          key={it.label}
          it={it}
          active={nav.top === i && (nav.open === null || nav.sub < 0)}
          open={nav.open === i}
          onEnter={() => setNav({ top: i, open: it.submenu ? i : null, sub: -1 })}
          onPick={() => {
            if (it.submenu) setNav((n) => ({ top: i, open: n.open === i ? null : i, sub: -1 }))
            else pick(it)
          }}
        >
          {it.submenu && nav.open === i && (
            <div className="menu submenu glass glass-pop" role="menu">
              {it.submenu.map((sit, si) => (
                <Row key={sit.label} it={sit} active={nav.sub === si} open={false} onEnter={() => setNav({ top: i, open: i, sub: si })} onPick={() => pick(sit)} />
              ))}
            </div>
          )}
        </Row>
      ))}
    </div>,
    document.body
  )
}
