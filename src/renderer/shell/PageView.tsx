import { useEffect, useRef, useState } from 'react'
import type { PageData } from '@shared/types'
import { useStore } from '../state/store'
import { kernel } from '../lib/kernel'
import { PageEditor, activeEditor } from '../editor/Editor'

// Seçili sayfa: başlık alanı + editör
export function PageView() {
  const currentId = useStore((s) => s.currentId)
  const [page, setPage] = useState<PageData | null>(null)

  useEffect(() => {
    let alive = true
    setPage(null)
    if (!currentId) return
    kernel.pages
      .read(currentId)
      .then((p) => alive && setPage(p))
      .catch(() => alive && useStore.getState().toast('Sayfa açılamadı', 'error'))
    return () => {
      alive = false
    }
  }, [currentId])

  if (!currentId) {
    return (
      <div className="empty-state">
        <h2>İlk sayfanı oluştur</h2>
        <span>Ders notlarını sayfalar ve alt sayfalar halinde düzenle.</span>
        <button className="btn primary" onClick={() => void useStore.getState().createPage(null)}>
          Yeni sayfa
        </button>
      </div>
    )
  }
  if (!page || page.id !== currentId) return null
  return (
    <article className="page" key={page.id}>
      <div className="page-column">
        <TitleField page={page} />
        <PageEditor page={page} />
      </div>
    </article>
  )
}

function TitleField({ page }: { page: PageData }) {
  const [title, setTitle] = useState(page.title === 'Adsız' ? '' : page.title)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  const committed = useRef(page.title)
  const chain = useRef<Promise<void>>(Promise.resolve())

  // yeni (Adsız) sayfada, yalnızca açılışta başlığa odaklan
  useEffect(() => {
    if (committed.current === 'Adsız') ref.current?.focus()
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
    const next = value.trim() || 'Adsız'
    chain.current = chain.current.then(async () => {
      if (next === committed.current) return
      const node = await kernel.pages.rename(page.id, next)
      committed.current = node.title
      await useStore.getState().refreshTree()
    })
    return chain.current.catch(() => useStore.getState().toast('Sayfa yeniden adlandırılamadı', 'error'))
  }

  return (
    <textarea
      ref={ref}
      className="page-title"
      data-testid="page-title"
      rows={1}
      placeholder="Adsız"
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
