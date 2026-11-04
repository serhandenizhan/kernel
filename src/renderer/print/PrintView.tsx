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
    kernelSnapshotHtml?: () => Promise<string>
  }
}

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob()
  return new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.readAsDataURL(blob)
  })
}

/** Tek dosyalık HTML: stiller tek <style>'da, kasa görselleri data: URI, betik yok (fontları ana süreç gömer) */
window.kernelSnapshotHtml = async () => {
  const css: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css.push(rule.cssText)
    } catch {
      // erişilemeyen stil sayfası
    }
  }
  const root = document.querySelector('.print-root')!.cloneNode(true) as HTMLElement
  root.querySelectorAll('[contenteditable]').forEach((el) => el.removeAttribute('contenteditable'))
  root.querySelectorAll('script').forEach((el) => el.remove())
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const src = img.getAttribute('src') ?? ''
    if (src.startsWith('kernel-file:')) img.setAttribute('src', await toDataUrl(src).catch(() => src))
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>('[style*="kernel-file:"]'))) {
    const m = /url\("?(kernel-file:[^")]+)"?\)/.exec(el.getAttribute('style') ?? '')
    if (m) el.setAttribute('style', (el.getAttribute('style') ?? '').replace(m[1]!, await toDataUrl(m[1]!).catch(() => m[1]!)))
  }
  const title = document.querySelector('.print-title')?.textContent ?? 'Kernel'
  const theme = document.documentElement.dataset['theme'] ?? 'light'
  return `<!doctype html>\n<html lang="tr" data-theme="${theme}" class="printing"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title.replace(/</g, '&lt;')}</title><style>${css.join('\n')}\n.print-root{max-width:780px;margin:40px auto;padding:0 24px}</style></head><body>${root.outerHTML}</body></html>`
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
      // Mermaid gibi asenkron çizimler bitene kadar bekle
      for (let i = 0; i < 200 && (window.kernelPendingRenders ?? 0) > 0; i++) await new Promise((r) => setTimeout(r, 50))
      await waitForImages()
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
