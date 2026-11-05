import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import { create } from 'zustand'
import { Selection } from '@tiptap/pm/state'
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
import { WikiMenu } from './ui/WikiMenu'
import { BubbleToolbar } from './ui/BubbleToolbar'
import { BlockHandle } from './ui/BlockHandle'
import { tNow } from '../lib/i18n'
import type { MessageKey } from '@shared/i18n'

/** Uygulama kapanırken açık sayfanın bekleyen kaydını yapar */
/** Açılışta imleci ilk metin konumuna koyar; sayfa ayırıcı çizgi ya da görselle başlıyorsa o blok seçilmesin */
function caretToFirstText(ed: TiptapEditor): void {
  const sel = Selection.findFrom(ed.state.doc.resolve(0), 1, true)
  if (sel) ed.view.dispatch(ed.state.tr.setSelection(sel).setMeta('addToHistory', false))
}

export const activeEditor: { flush: (() => Promise<boolean>) | null; editor: TiptapEditor | null; meta: PageMeta | null; setMeta: ((m: PageMeta) => void) | null } = {
  flush: null,
  editor: null,
  meta: null,
  setMeta: null
}

/** Bölünmüş ekranın ikinci editörünün bekleyen kaydı (kapanışta, dışa aktarmada hepsi yazılır) */
export const extraFlushes = new Set<() => Promise<boolean>>()
/** Tüm açık editörlerin bekleyen kaydını yazar; hepsi kaydedildiyse true */
export async function flushAll(): Promise<boolean> {
  const results = await Promise.all([activeEditor.flush ? activeEditor.flush() : true, ...[...extraFlushes].map((f) => f())])
  return results.every(Boolean)
}

/** Açık editör (içindekiler paneli gibi bileşenler için tepkisel) */
export const useActiveEditor = create<{ editor: TiptapEditor | null }>(() => ({ editor: null }))

const STATUS_KEY: Record<SaveState, MessageKey> = { saved: 'editor.status.saved', dirty: 'editor.status.dirty', saving: 'editor.status.saving', error: 'editor.status.error' }

export function PageEditor({ page, secondary = false }: { page: PageData; secondary?: boolean }) {
  const parsed = useMemo(() => {
    if (page.readOnly) return { doc: null, error: tNow('editor.readOnlyBroken') }
    try {
      return { doc: markdownToDoc(page.markdown), error: null as string | null }
    } catch (e) {
      return { doc: null, error: e instanceof Error ? e.message : tNow('editor.readFailed') }
    }
  }, [page.markdown, page.readOnly])

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
  return <LiveEditor page={page} initial={parsed.doc} secondary={secondary} />
}

function LiveEditor({ page, initial, secondary }: { page: PageData; initial: ReturnType<typeof markdownToDoc>; secondary: boolean }) {
  const [status, setStatus] = useState<SaveState>('saved')
  const [conflict, setConflict] = useState(false)
  const [wrap, setWrap] = useState<HTMLDivElement | null>(null)
  const metaRef = useRef<PageMeta>(page.meta)
  const editorRef = useRef<TiptapEditor | null>(null)
  // son belge anlık görüntüsü: editör yok edildikten sonra da (sayfa değişimi) kaydedilebilsin
  const docRef = useRef<ReturnType<TiptapEditor['getJSON']> | null>(null)

  const autosave = useMemo(
    () =>
      createAutosave(
        async () => {
          const ed = editorRef.current
          const doc = ed && !ed.isDestroyed ? ed.getJSON() : docRef.current
          if (!doc) return
          const markdown = docToMarkdown(doc)
          const { updated } = await kernel.pages.write(page.id, { markdown, meta: metaRef.current })
          metaRef.current = { ...metaRef.current, updated }
        },
        500,
        (s) => {
          setStatus(s)
          if (s === 'error') useStore.getState().toast(tNow('editor.saveFailed'), 'error')
        }
      ),
    [page.id]
  )

  const editor = useEditor(
    {
      extensions: buildExtensions(),
      content: initial,
      autofocus: false,
      onCreate: ({ editor: ed }) => caretToFirstText(ed),
      editorProps: { attributes: { class: 'kernel-editor', 'data-testid': 'editor', spellcheck: 'true' } },
      onUpdate: ({ editor: ed }) => {
        docRef.current = ed.getJSON()
        autosave.schedule()
      }
    },
    [page.id]
  )
  editorRef.current = editor

  // sayfa değişince ya da bileşen kapanınca bekleyen kaydı yap
  useEffect(() => {
    if (secondary) {
      const f = () => autosave.flush()
      extraFlushes.add(f)
      return () => {
        extraFlushes.delete(f)
        void autosave.flush()
        autosave.dispose()
      }
    }
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
  }, [autosave, editor, secondary])

  // dış değişiklik
  useEffect(() => {
    return kernel.events.onPageChangedExternally(async (id) => {
      if (id !== page.id || !editorRef.current) return
      if (autosave.state === 'saved') {
        const fresh = await kernel.pages.read(page.id)
        if (fresh.readOnly) return
        metaRef.current = fresh.meta
        try {
          editorRef.current.commands.setContent(markdownToDoc(fresh.markdown), { emitUpdate: false })
          caretToFirstText(editorRef.current)
        } catch {
          useStore.getState().toast(tNow('editor.externalUnreadable'), 'error')
        }
      } else {
        // karar verilene kadar kaydetme: dış değişikliğin üzerine yazılmasın
        autosave.pause()
        setConflict(true)
      }
    })
  }, [page.id, autosave])

  return (
    <>
      <span className={`save-status ${status}`} data-testid="save-status">
        {tNow(STATUS_KEY[status])}
      </span>
      <div className="editor-wrap" ref={setWrap}>
        <EditorContent editor={editor} />
        {editor && <BlockHandle editor={editor} container={wrap} />}
      </div>
      {editor && <TableMenu editor={editor} />}
      {editor && <BubbleToolbar editor={editor} />}
      {/* menüler ortak durumdan çizilir: yalnızca ana bölme çizer (ikinci bölmede de çalışır) */}
      {!secondary && <SlashMenu />}
      {!secondary && <WikiMenu />}
      <MathPopover editor={editor} />
      {conflict && (
        <ConflictDialog
          onKeepMine={async () => {
            setConflict(false)
            autosave.resume()
            autosave.schedule()
            await autosave.flush()
          }}
          onLoadDisk={async () => {
            setConflict(false)
            const fresh = await kernel.pages.read(page.id)
            metaRef.current = fresh.meta
            editorRef.current?.commands.setContent(markdownToDoc(fresh.markdown), { emitUpdate: false })
            docRef.current = editorRef.current?.getJSON() ?? null
            autosave.reset()
            autosave.resume()
          }}
        />
      )}
    </>
  )
}
