import { useEffect, useRef, useState } from 'react'
import type { PageMeta } from '@shared/types'
import { COVER_PRESETS, coverCss } from '../assets/covers'
import { toVaultUrl } from '../editor/nodes/Image'
import { activeEditor } from '../editor/Editor'
import { useStore } from '../state/store'
import { tNow } from '../lib/i18n'
import { IconPicker } from './IconPicker'
import { kernel } from '../lib/kernel'
import { CoverPicker } from './CoverPicker'
import { Icon } from '../assets/icons'

const isImagePath = (icon: string) => icon.startsWith('attachments/')

export function PageIcon({ icon, size }: { icon: string; size: number }) {
  return isImagePath(icon) ? <img src={toVaultUrl(icon)} width={size} height={size} alt="" style={{ objectFit: 'cover', borderRadius: 8 }} /> : <span style={{ fontSize: size * 0.85 }}>{icon}</span>
}

// Sayfa başlığının üstü: kapak ve ikon (spec §5)
export function PageHeader({ initialMeta }: { initialMeta: PageMeta }) {
  const pinned = useStore((s) => s.pins.includes(initialMeta.id))
  const [meta, setMeta] = useState<PageMeta>(initialMeta)
  const [iconPicker, setIconPicker] = useState<DOMRect | null>(null)
  const [coverPicker, setCoverPicker] = useState<DOMRect | null>(null)
  const [repositioning, setRepositioning] = useState(false)
  const [pos, setPos] = useState(initialMeta.coverPosition ?? 0.5)
  const iconRef = useRef<HTMLButtonElement>(null)
  const addIconRef = useRef<HTMLButtonElement>(null)
  const stopDragRef = useRef<(() => void) | null>(null)
  useEffect(() => () => stopDragRef.current?.(), [])

  const update = async (patch: Partial<PageMeta>) => {
    const next: PageMeta = { ...(activeEditor.meta ?? meta), ...patch }
    for (const k of Object.keys(patch) as (keyof PageMeta)[]) if (patch[k] === undefined) delete next[k]
    setMeta(next)
    activeEditor.setMeta?.(next)
    await activeEditor.flush?.()
    if ('icon' in patch) await useStore.getState().refreshTree()
  }

  // kenar çubuğundaki "İkon değiştir" menüsü
  useEffect(() => {
    const open = () => {
      const el = iconRef.current ?? addIconRef.current
      if (el) setIconPicker(el.getBoundingClientRect())
    }
    window.addEventListener('kernel:open-icon-picker', open)
    return () => window.removeEventListener('kernel:open-icon-picker', open)
  }, [])

  const cover = coverCss(meta.cover, toVaultUrl)
  const isImageCover = Boolean(meta.cover && !meta.cover.startsWith('kernel:'))

  const startDrag = (e: React.MouseEvent) => {
    if (!repositioning) return
    e.preventDefault()
    stopDragRef.current?.()
    const startY = e.clientY
    const start = pos
    const onMove = (ev: MouseEvent) => setPos(Math.min(1, Math.max(0, start - (ev.clientY - startY) / 200)))
    const stop = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', stop)
      if (stopDragRef.current === stop) stopDragRef.current = null
    }
    stopDragRef.current = stop
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', stop)
  }

  return (
    <div className={`page-header${cover ? ' has-cover' : ''}${meta.icon ? ' has-icon' : ''}`}>
      {cover && (
        <div
          className={`page-cover${repositioning ? ' repositioning' : ''}`}
          data-testid="page-cover"
          style={{ background: cover, backgroundPositionY: isImageCover ? `${Math.round(pos * 100)}%` : undefined }}
          onMouseDown={startDrag}
        >
          {meta.coverCredit && (
            <button
              className="cover-credit"
              data-testid="cover-credit"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => meta.coverCreditUrl && void kernel.unsplash.open(meta.coverCreditUrl)}
            >
              {meta.coverCredit}
            </button>
          )}
          <div className="cover-actions">
            {repositioning ? (
              <button
                className="glass-btn"
                data-testid="cover-reposition-done"
                onClick={() => {
                  setRepositioning(false)
                  void update({ coverPosition: Math.round(pos * 100) / 100 })
                }}
              >
                {tNow('header.coverSave')}
              </button>
            ) : (
              <>
                <button className="glass-btn" data-testid="cover-change" onClick={(e) => setCoverPicker(e.currentTarget.getBoundingClientRect())}>
                  <Icon name="image" size={13} /> {tNow('header.coverChange')}
                </button>
                {isImageCover && (
                  <button className="glass-btn" data-testid="cover-reposition" onClick={() => setRepositioning(true)}>
                    {tNow('header.coverReposition')}
                  </button>
                )}
                <button className="glass-btn" data-testid="cover-remove" onClick={() => void update({ cover: undefined, coverPosition: undefined, coverCredit: undefined, coverCreditUrl: undefined })}>
                  <Icon name="trash" size={13} /> {tNow('header.coverRemove')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <div className="page-column header-column">
        {meta.icon && (
          <button ref={iconRef} className="page-icon" data-testid="page-icon" onClick={(e) => setIconPicker(e.currentTarget.getBoundingClientRect())}>
            <PageIcon icon={meta.icon} size={72} />
          </button>
        )}
        <div className="header-actions">
          {!meta.icon && (
            <button ref={addIconRef} className="ghost-btn has-tip" data-testid="add-icon" data-tip={tNow('header.addIcon')} aria-label={tNow('header.addIcon')} onClick={(e) => setIconPicker(e.currentTarget.getBoundingClientRect())}>
              <Icon name="smile" size={16} />
            </button>
          )}
          {!meta.cover && (
            <button className="ghost-btn has-tip" data-testid="add-cover" data-tip={tNow('header.addCover')} aria-label={tNow('header.addCover')} onClick={() => void update({ cover: COVER_PRESETS[Math.floor(Math.random() * COVER_PRESETS.length)]!.id })}>
              <Icon name="cover" size={16} />
            </button>
          )}
          <button
            className={`ghost-btn has-tip pin-btn${pinned ? ' on' : ''}`}
            data-testid="pin-toggle"
            data-tip={pinned ? tNow('header.unpin') : tNow('header.pin')}
            aria-label={pinned ? tNow('header.unpin') : tNow('header.pin')}
            aria-pressed={pinned}
            onClick={() => void useStore.getState().togglePin(initialMeta.id)}
          >
            <Icon name="pin" size={16} />
          </button>
        </div>
      </div>
      {iconPicker && (
        <IconPicker
          anchor={iconPicker}
          onClose={() => setIconPicker(null)}
          onPick={(icon) => {
            setIconPicker(null)
            void update({ icon })
          }}
          onRemove={() => {
            setIconPicker(null)
            void update({ icon: undefined })
          }}
        />
      )}
      {coverPicker && (
        <CoverPicker
          anchor={coverPicker}
          onClose={() => setCoverPicker(null)}
          onPick={(c, credit) => {
            setCoverPicker(null)
            setPos(0.5)
            // Unsplash dışı kapaklarda eski fotoğrafçı satırı kalkar (undefined alanı siler)
            void update({ cover: c, coverPosition: undefined, coverCredit: credit?.credit, coverCreditUrl: credit?.creditUrl || undefined })
          }}
        />
      )}
    </div>
  )
}
