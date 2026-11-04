import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import { create } from 'zustand'
import type { PageData, PageMeta } from '@shared/types'
import { markdownToDoc } from '@core/markdown/parse'
import { docToMarkdown } from '@core/markdown/serialize'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { buildExtensions } from './extensions'
import { createAutosave, type SaveState } from './autosave'
import { ConflictDialog } from '../shell/ConflictDialog'
import { MathPopover } from './ui/MathPopover'
import { TableMenu } from './ui/TableMenu'
import { SlashMenu } from './ui/SlashMenu'
import { BubbleToolbar } from './ui/BubbleToolbar'
import { BlockHandle } from './ui/BlockHandle'

/** Uygulama kapanırken açık sayfanın bekleyen kaydını yapar */
export const activeEditor: { flush: (() => Promise<void>) | null; editor: TiptapEditor | null; meta: PageMeta | null; setMeta: ((m: PageMeta) => void) | null } = {
  flush: null,
  editor: null,
  meta: null,
  setMeta: null
}

/** Açık editör (içindekiler paneli gibi bileşenler için tepkisel) */
export const useActiveEditor = create<{ editor: TiptapEditor | null }>(() => ({ editor: null }))

const STATUS_TEXT: Record<SaveState, string> = { saved: 'Kaydedildi', dirty: 'Düzenleniyor', saving: 'Kaydediliyor', error: 'Kaydedilemedi' }

export function PageEditor({ page }: { page: PageData }) {
  const parsed = useMemo(() => {
    try {
      return { doc: markdownToDoc(page.markdown), error: null as string | null }
    } catch (e) {
      return { doc: null, error: e instanceof Error ? e.message : 'Dosya okunamadı' }
    }
  }, [page.markdown])

  if (!parsed.doc) {
    return (
      <div className="page-body">
        <div className="readonly-banner" data-testid="readonly-banner">
          Bu dosya düzenlenemiyor ({parsed.error}). Dosyayı korumak için salt okunur açıldı.
        </div>
        <pre className="raw-view">{page.markdown.replace(/\u0000/g, '�')}</pre>
      </div>
    )
  }
  return <LiveEditor page={page} initial={parsed.doc} />
}

function LiveEditor({ page, initial }: { page: PageData; initial: ReturnType<typeof markdownToDoc> }) {
  const [status, setStatus] = useState<SaveState>('saved')
  const [conflict, setConflict] = useState(false)
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null)
  const metaRef = useRef<PageMeta>(page.meta)
  const editorRef = useRef<TiptapEditor | null>(null)

  const autosave = useMemo(
    () =>
      createAutosave(
        async () => {
          const ed = editorRef.current
          if (!ed || ed.isDestroyed) return
          const markdown = docToMarkdown(ed.getJSON())
          const { updated } = await kernel.pages.write(page.id, { markdown, meta: metaRef.current })
          metaRef.current = { ...metaRef.current, updated }
        },
        500,
        setStatus
      ),
    [page.id]
  )

  const editor = useEditor(
    {
      extensions: buildExtensions(),
      content: initial,
      autofocus: false,
      editorProps: { attributes: { class: 'kernel-editor', 'data-testid': 'editor', spellcheck: 'true' } },
      onUpdate: () => autosave.schedule()
    },
    [page.id]
  )
  editorRef.current = editor

  // sayfa değişince ya da bileşen kapanınca bekleyen kaydı yap
  useEffect(() => {
    activeEditor.flush = () => autosave.flush()
    activeEditor.editor = editor
    useActiveEditor.setState({ editor })
    activeEditor.meta = metaRef.current
    activeEditor.setMeta = (m) => {
      metaRef.current = m
      activeEditor.meta = m
      autosave.schedule()
    }
    return () => {
      void autosave.flush()
      autosave.dispose()
      if (activeEditor.editor === editor) {
        Object.assign(activeEditor, { flush: null, editor: null, meta: null, setMeta: null })
        useActiveEditor.setState({ editor: null })
      }
    }
  }, [autosave, editor])

  // dış değişiklik
  useEffect(() => {
    return kernel.events.onPageChangedExternally(async (id) => {
      if (id !== page.id || !editorRef.current) return
      if (autosave.state === 'saved') {
        const fresh = await kernel.pages.read(page.id)
        metaRef.current = fresh.meta
        try {
          editorRef.current.commands.setContent(markdownToDoc(fresh.markdown), { emitUpdate: false })
        } catch {
          useStore.getState().toast('Dosya dışarıda değişti ama okunamadı', 'error')
        }
      } else {
        setConflict(true)
      }
    })
  }, [page.id, autosave])

  return (
    <>
      <span className={`save-status ${status}`} data-testid="save-status">
        {STATUS_TEXT[status]}
      </span>
      <div className="editor-wrap" ref={setWrap}>
        <EditorContent editor={editor} />
        {editor && <BlockHandle editor={editor} container={wrap} />}
      </div>
      {editor && <TableMenu editor={editor} />}
      {editor && <BubbleToolbar editor={editor} />}
      <SlashMenu />
      <MathPopover editor={editor} />
      {conflict && (
        <ConflictDialog
          onKeepMine={async () => {
            setConflict(false)
            autosave.schedule()
            await autosave.flush()
          }}
          onLoadDisk={async () => {
            setConflict(false)
            const fresh = await kernel.pages.read(page.id)
            metaRef.current = fresh.meta
            editorRef.current?.commands.setContent(markdownToDoc(fresh.markdown), { emitUpdate: false })
          }}
        />
      )}
    </>
  )
}
