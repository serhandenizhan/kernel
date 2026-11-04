import { useEffect, useMemo, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { PageData, PdfOptions } from '@shared/types'
import { markdownToDoc } from '@core/markdown/parse'
import { kernel } from '../lib/kernel'
import { buildExtensions } from '../editor/extensions'
import { getHighlighter } from '../lib/shiki'
import { coverCss } from '../assets/covers'
import { toVaultUrl } from '../editor/nodes/Image'
import { PageIcon } from '../shell/PageHeader'

declare global {
  interface Window {
    kernelPrintReady?: boolean
    kernelPrintError?: string
  }
}

function parseParams(): { ids: string[]; opts: PdfOptions } {
  const query = location.hash.split('?')[1] ?? ''
  const params = new URLSearchParams(query)
  return { ids: (params.get('ids') ?? '').split(',').filter(Boolean), opts: JSON.parse(params.get('opts') ?? '{}') as PdfOptions }
}

function PrintDoc({ markdown, onReady }: { markdown: string; onReady(): void }) {
  const content = useMemo(() => markdownToDoc(markdown), [markdown])
  const editor = useEditor({ extensions: buildExtensions({ readOnly: true }), content, editable: false })
  useEffect(() => {
    if (editor) onReady()
  }, [editor, onReady])
  return <EditorContent editor={editor} />
}

/** Bir öğenin tüm görsellerinin yüklenmesini bekler */
async function waitForImages(): Promise<void> {
  const imgs = Array.from(document.images)
  await Promise.all(imgs.map((img) => (img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => undefined))))
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

// PDF için salt okunur, baskıya özel görünüm (#/print). Editörle aynı bileşenler kullanılır.
export function PrintView() {
  const { ids, opts } = useMemo(parseParams, [])
  const [pages, setPages] = useState<PageData[] | null>(null)
  const [readyCount, setReadyCount] = useState(0)

  useEffect(() => {
    document.documentElement.dataset['theme'] = opts.theme === 'dark' ? 'dark' : 'light'
    document.documentElement.classList.add('printing')
    void (async () => {
      try {
        const settings = await kernel.settings.get()
        document.documentElement.dataset['bodyFont'] = settings.bodyFont
        await getHighlighter()
        setPages(await Promise.all(ids.map((id) => kernel.pages.read(id))))
      } catch (e) {
        window.kernelPrintError = e instanceof Error ? e.message : String(e)
      }
    })()
  }, [ids, opts.theme])

  useEffect(() => {
    if (!pages || readyCount < pages.length) return
    void (async () => {
      await nextFrame()
      await waitForImages()
      await document.fonts.ready
      await nextFrame()
      await nextFrame()
      window.kernelPrintReady = true
    })()
  }, [pages, readyCount])

  const onReady = useMemo(() => () => setReadyCount((n) => n + 1), [])

  if (!pages) return null
  return (
    <div className="print-root">
      {pages.map((p, i) => {
        const cover = opts.showCover ? coverCss(p.meta.cover, toVaultUrl) : null
        return (
          <section key={p.id} className={`print-page${i > 0 ? ' new-page' : ''}`}>
            {cover && <div className="print-cover" style={{ background: cover, backgroundPositionY: `${Math.round((p.meta.coverPosition ?? 0.5) * 100)}%` }} />}
            {p.meta.icon && (
              <div className={`print-icon${cover ? ' over-cover' : ''}`}>
                <PageIcon icon={p.meta.icon} size={56} />
              </div>
            )}
            <h1 className="print-title">{p.title}</h1>
            <div className="kernel-editor print-body">
              <PrintDoc markdown={p.markdown} onReady={onReady} />
            </div>
          </section>
        )
      })}
    </div>
  )
}
