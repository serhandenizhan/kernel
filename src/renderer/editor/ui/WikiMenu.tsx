import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { useWikiMenu } from './wiki-state'
import { useT } from '../../lib/i18n'
import { Icon } from '../../assets/icons'
import { toVaultUrl } from '@core/vault-url'

// "[[" sayfa seçici (cam yüzey; slash menüsüyle aynı görünüm)
export function WikiMenu() {
  const t = useT()
  const { open, items, index, rect, choose } = useWikiMenu()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open || !rect) return null
  const top = rect.bottom + 6 + 320 > window.innerHeight ? Math.max(8, rect.top - 326) : rect.bottom + 6
  // body'ye çizilir: sayfa yüzeyinin cam efekti (backdrop-filter) sabit konumlu menüleri kaydırmasın
  return createPortal(
    <div className="slash-menu wiki-menu glass glass-pop" data-testid="wiki-menu" style={{ left: rect.left, top }} onMouseDown={(e) => e.preventDefault()}>
      {items.length === 0 ? (
        <div className="slash-empty">{t('wiki.typeToSearch')}</div>
      ) : (
        <div ref={listRef} className="slash-list">
          {items.map((it, i) => (
            <button
              key={it.kind === 'page' ? it.id : 'create'}
              data-index={i}
              data-testid="wiki-item"
              className={`slash-item${i === index ? ' active' : ''}`}
              onMouseEnter={() => useWikiMenu.setState({ index: i })}
              onClick={() => choose(i)}
            >
              <span className="slash-icon">
                {it.kind === 'create' ? <Icon name="plus" /> : it.icon?.startsWith('attachments/') ? <img src={toVaultUrl(it.icon)} alt="" width={16} height={16} /> : (it.icon ?? <Icon name="doc" />)}
              </span>
              <span className="wiki-item-text">
                {it.kind === 'create' ? t('wiki.create', { title: it.title }) : it.title}
                {it.kind === 'page' && it.path.includes('/') && <span className="wiki-item-path">{it.path.replace(/\.md$/i, '')}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
