import { useEffect, useRef, useState } from 'react'
import type { PageData } from '@shared/types'
import { useStore } from '../state/store'
import { tNow } from '../lib/i18n'
import { isUntitled } from '@shared/i18n'
import { kernel } from '../lib/kernel'
import { PageEditor, activeEditor } from '../editor/Editor'
import { PageHeader } from './PageHeader'
import { Backlinks } from './Backlinks'

// Seçili sayfa: başlık alanı + editör
export function PageView() {
  const currentId = useStore((s) => s.currentId)
  const reloadToken = useStore((s) => s.reloadToken)
  const [page, setPage] = useState<PageData | null>(null)

  useEffect(() => {
    let alive = true
    setPage(null)
    if (!currentId) return
    kernel.pages
      .read(currentId)
      .then((p) => alive && setPage(p))
      .catch(() => alive && useStore.getState().toast(tNow('page.openFailed'), 'error'))
    return () => {
      alive = false
    }
  }, [currentId, reloadToken])

  if (!currentId) {
    return (
      <div className="empty-state">
        <h2>{tNow('page.emptyTitle')}</h2>
        <span>{tNow('page.emptyHint')}</span>
        <button className="btn primary" onClick={() => void useStore.getState().createPage(null)}>
          {tNow('page.new')}
        </button>
      </div>
    )
  }
  if (!page || page.id !== currentId) return null
  return (
    <article className="page" key={`${page.id}:${reloadToken}`}>
      {!page.readOnly && <PageHeader initialMeta={page.meta} />}
      <div className="page-column">
        <TitleField page={page} />
        <PageEditor page={page} />
        <Backlinks pageId={page.id} />
      </div>
    </article>
  )
}

function TitleField({ page }: { page: PageData }) {
  const [title, setTitle] = useState(isUntitled(page.title) ? '' : page.title)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  const committed = useRef(page.title)
  const chain = useRef<Promise<void>>(Promise.resolve())

  // yeni (Adsız) sayfada, yalnızca açılışta başlığa odaklan
  useEffect(() => {
    if (isUntitled(committed.current)) ref.current?.focus()
  }, [page.id])

  useEffect(() => {
    const el = ref.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [title])

  // Enter, blur ve zamanlayıcı aynı anda tetikleyebilir: yeniden adlandırmalar sırayla ve bir kez yapılır
  const commit = (value: string): Promise<void> => {
    if (timer.current) clearTimeout(timer.current)
    const next = value.trim() || tNow('page.untitled')
    chain.current = chain.current.then(async () => {
      if (next === committed.current) return
      const node = await kernel.pages.rename(page.id, next)
      committed.current = node.title
      await useStore.getState().refreshTree()
    })
    return chain.current.catch(() => useStore.getState().toast(tNow('page.renameFailed'), 'error'))
  }

  return (
    <textarea
      ref={ref}
      className="page-title"
      data-testid="page-title"
      rows={1}
      placeholder={tNow('page.untitled')}
      value={title}
      onChange={(e) => {
        const v = e.target.value.replace(/\n/g, '')
        setTitle(v)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => void commit(v), 500)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          void commit(title)
          // TipTap'in focus komutu bir kare gecikir; hemen yazılan harf başlığa kaçmasın diye senkron odakla
          const ed = activeEditor.editor
          if (ed && !ed.isDestroyed) {
            ed.view.focus()
            ed.commands.setTextSelection(1)
          }
        }
      }}
      onBlur={() => void commit(title)}
    />
  )
}
