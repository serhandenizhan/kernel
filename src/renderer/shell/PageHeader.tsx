import { useEffect, useRef, useState } from 'react'
import type { PageMeta } from '@shared/types'
import { COVER_PRESETS, coverCss } from '../assets/covers'
import { toVaultUrl } from '../editor/nodes/Image'
import { activeEditor } from '../editor/Editor'
import { useStore } from '../state/store'
import { IconPicker } from './IconPicker'
import { CoverPicker } from './CoverPicker'

const isImagePath = (icon: string) => icon.startsWith('attachments/')

export function PageIcon({ icon, size }: { icon: string; size: number }) {
  return isImagePath(icon) ? <img src={toVaultUrl(icon)} width={size} height={size} alt="" style={{ objectFit: 'cover', borderRadius: 8 }} /> : <span style={{ fontSize: size * 0.85 }}>{icon}</span>
}

// Sayfa başlığının üstü: kapak ve ikon (spec §5)
export function PageHeader({ initialMeta }: { initialMeta: PageMeta }) {
  const [meta, setMeta] = useState<PageMeta>(initialMeta)
  const [iconPicker, setIconPicker] = useState<DOMRect | null>(null)
  const [coverPicker, setCoverPicker] = useState<DOMRect | null>(null)
  const [repositioning, setRepositioning] = useState(false)
  const [pos, setPos] = useState(initialMeta.coverPosition ?? 0.5)
  const iconRef = useRef<HTMLButtonElement>(null)
  const addIconRef = useRef<HTMLButtonElement>(null)

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
    const startY = e.clientY
    const start = pos
    const onMove = (ev: MouseEvent) => setPos(Math.min(1, Math.max(0, start - (ev.clientY - startY) / 200)))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
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
                Konumu kaydet
              </button>
            ) : (
              <>
                <button className="glass-btn" data-testid="cover-change" onClick={(e) => setCoverPicker(e.currentTarget.getBoundingClientRect())}>
                  Değiştir
                </button>
                {isImageCover && (
                  <button className="glass-btn" data-testid="cover-reposition" onClick={() => setRepositioning(true)}>
                    Konumlandır
                  </button>
                )}
                <button className="glass-btn" onClick={() => void update({ cover: undefined, coverPosition: undefined })}>
                  Kaldır
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
            <button ref={addIconRef} className="ghost-btn" data-testid="add-icon" onClick={(e) => setIconPicker(e.currentTarget.getBoundingClientRect())}>
              ☺ İkon ekle
            </button>
          )}
          {!meta.cover && (
            <button className="ghost-btn" data-testid="add-cover" onClick={() => void update({ cover: COVER_PRESETS[Math.floor(Math.random() * COVER_PRESETS.length)]!.id })}>
              ▭ Kapak ekle
            </button>
          )}
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
          onPick={(c) => {
            setCoverPicker(null)
            setPos(0.5)
            void update({ cover: c, coverPosition: undefined })
          }}
        />
      )}
    </div>
  )
}
