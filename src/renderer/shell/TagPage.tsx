import { useEffect, useState } from 'react'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { useTn } from '../lib/i18n'
import { Icon } from '../assets/icons'

// Etiket görünümü: o etiketi taşıyan sayfalar (spec §12)
export function TagPage() {
  const tn = useTn()
  const tag = useStore((s) => s.currentTag)
  const [pages, setPages] = useState<{ id: string; title: string }[]>([])

  useEffect(() => {
    if (!tag) return
    let alive = true
    const load = () => void kernel.tags.pages(tag).then((p) => alive && setPages(p))
    load()
    const off = kernel.events.onLinksChanged(load)
    return () => {
      alive = false
      off()
    }
  }, [tag])

  if (!tag) return null
  return (
    <article className="page tag-page" data-testid="tag-page">
      <div className="page-column">
        <h1 className="tag-page-title">#{tag}</h1>
        <p className="tag-page-count">{tn('tags.pageCount', pages.length)}</p>
        <ul className="tag-page-list">
          {pages.map((p) => (
            <li key={p.id}>
              <button className="nav-row tag-page-row" data-testid="tag-page-row" onClick={() => useStore.getState().openPage(p.id)}>
                <Icon name="doc" size={14} />
                <span className="nav-label">{p.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}
