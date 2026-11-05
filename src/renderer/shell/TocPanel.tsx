import { useEffect, useState } from 'react'
import { useActiveEditor } from '../editor/Editor'
import { useStore } from '../state/store'
import { tNow } from '../lib/i18n'

interface Heading {
  pos: number
  level: number
  text: string
}

// Sağdaki içindekiler paneli: başlıklardan otomatik, tıklayınca kaydırır, okunan bölüm vurgulanır
export function TocPanel() {
  const editor = useActiveEditor((s) => s.editor)
  const visible = useStore((s) => s.tocVisible)
  const [headings, setHeadings] = useState<Heading[]>([])
  const [active, setActive] = useState<number | null>(null)

  useEffect(() => {
    if (!editor) return
    const collect = () => {
      const list: Heading[] = []
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') list.push({ pos, level: Number(node.attrs['level']), text: node.textContent })
        return node.type.name !== 'heading'
      })
      setHeadings(list)
    }
    collect()
    editor.on('update', collect)
    return () => {
      editor.off('update', collect)
    }
  }, [editor])

  // görünür bölüm: üst kenarı geçmiş son başlık
  useEffect(() => {
    if (!editor || !visible) return
    const surface = document.querySelector('.page-surface')
    if (!surface) return
    const onScroll = () => {
      const top = surface.getBoundingClientRect().top + 80
      let current: number | null = null
      for (const h of headings) {
        const dom = editor.view.nodeDOM(h.pos) as HTMLElement | null
        if (dom && dom.getBoundingClientRect().top <= top) current = h.pos
      }
      setActive(current ?? headings[0]?.pos ?? null)
    }
    onScroll()
    surface.addEventListener('scroll', onScroll, { passive: true })
    return () => surface.removeEventListener('scroll', onScroll)
  }, [editor, visible, headings])

  if (!visible || !editor) return null
  const minLevel = Math.min(...headings.map((h) => h.level), 6)
  return (
    <nav className="toc glass" aria-label={tNow('toc.title')}>
      <div className="toc-title">{tNow('toc.title')}</div>
      {headings.length === 0 && <div className="toc-empty">{tNow('toc.empty')}</div>}
      {headings.map((h) => (
        <button
          key={h.pos}
          data-testid="toc-item"
          className={`toc-item${active === h.pos ? ' active' : ''}`}
          style={{ paddingLeft: 10 + (h.level - minLevel) * 12 }}
          onClick={() => {
            const dom = editor.view.nodeDOM(h.pos) as HTMLElement | null
            dom?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        >
          {h.text || tNow('toc.untitledHeading')}
        </button>
      ))}
    </nav>
  )
}
