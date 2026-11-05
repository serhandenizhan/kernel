import { useEffect, useState } from 'react'
import type { Backlink } from '@shared/types'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { useT } from '../lib/i18n'
import { Icon } from '../assets/icons'

// Sayfanın altında "Bu sayfaya bağlananlar" (spec §12); link yoksa hiç görünmez
export function Backlinks({ pageId }: { pageId: string }) {
  const t = useT()
  const [items, setItems] = useState<Backlink[]>([])
  const openPage = useStore((s) => s.openPage)

  useEffect(() => {
    let alive = true
    const load = () =>
      void kernel.links
        .backlinks(pageId)
        .then((b) => alive && setItems(b))
        .catch(() => alive && setItems([]))
    load()
    const off = kernel.events.onLinksChanged(load)
    return () => {
      alive = false
      off()
    }
  }, [pageId])

  if (items.length === 0) return null
  return (
    <section className="backlinks" data-testid="backlinks" aria-label={t('backlinks.title')}>
      <h3 className="backlinks-title">
        {t('backlinks.title')} <span className="backlinks-count">{items.length}</span>
      </h3>
      <ul>
        {items.map((b) => (
          <li key={b.id}>
            <button className="backlink" data-testid="backlink" onClick={() => openPage(b.id)}>
              <span className="backlink-page">
                <Icon name="doc" size={14} /> {b.title}
              </span>
              {b.context && <span className="backlink-context">{b.context}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
