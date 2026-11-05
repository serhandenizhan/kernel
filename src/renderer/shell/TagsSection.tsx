import { useEffect, useState } from 'react'
import type { TagCount } from '@shared/types'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { useT } from '../lib/i18n'
import { Icon } from '../assets/icons'

// Kenar çubuğunda katlanır "Etiketler" bölümü; etiket yoksa görünmez
export function TagsSection() {
  const t = useT()
  const [tags, setTags] = useState<TagCount[]>([])
  const [open, setOpen] = useState(false)
  const current = useStore((s) => (s.view === 'tag' ? s.currentTag : null))

  useEffect(() => {
    let alive = true
    const load = () => void kernel.tags.list().then((x) => alive && setTags(x))
    load()
    const off = kernel.events.onLinksChanged(load)
    return () => {
      alive = false
      off()
    }
  }, [])

  if (!tags.length) return null
  return (
    <div className="sidebar-tags">
      <button className="sidebar-section sidebar-section-toggle" data-testid="tags-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{t('tags.title')}</span>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={12} />
      </button>
      {open && (
        <div className="tag-list">
          {tags.map((x) => (
            <button key={x.tag} className={`nav-row tag-row${current === x.tag ? ' active' : ''}`} data-testid="tag-row" onClick={() => useStore.getState().openTag(x.tag)}>
              <span className="tag-hash">#</span>
              <span className="nav-label">{x.tag}</span>
              <span className="tag-count">{x.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
