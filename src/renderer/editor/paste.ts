import { Extension, type Editor, type JSONContent } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { convertPaste } from '@core/smart-paste'
import { useStore } from '../state/store'
import { kernel } from '../lib/kernel'
import { insertImageFiles } from './nodes/Image'

interface LastPaste {
  from: number
  to: number
  raw: string
}

interface SmartPasteStorage {
  last: LastPaste | null
  suggestions: Set<string>
}

const suggestKey = new PluginKey<DecorationSet>('smartPasteSuggest')

/** Ham metni paragraf düğümlerine çevirir (Cmd+Z ve Cmd+Shift+V için) */
function rawParagraphs(text: string): JSONContent[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => (line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' }))
}

function insertRaw(editor: Editor, text: string): void {
  if (editor.isActive('codeBlock')) editor.chain().focus().insertContent(text).run()
  else editor.chain().focus().insertContent(rawParagraphs(text)).run()
}

/** Yapıştırılan uzak görselleri kasaya indirir */
async function downloadRemoteImages(editor: Editor, doc: JSONContent): Promise<void> {
  const urls = new Set<string>()
  const walk = (n: JSONContent) => {
    if (n.type === 'image' && /^https?:\/\//.test(String(n.attrs?.['src'] ?? ''))) urls.add(String(n.attrs!['src']))
    n.content?.forEach(walk)
  }
  walk(doc)
  for (const url of urls) {
    const local = await kernel.attachments.fetchRemote(url)
    if (!local) {
      useStore.getState().toast('Bir görsel indirilemedi, bağlantı olarak bırakıldı', 'error')
      continue
    }
    const tr = editor.state.tr
    editor.state.doc.descendants((node: PMNode, pos: number) => {
      if (node.type.name === 'image' && node.attrs['src'] === url) tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: local })
    })
    editor.view.dispatch(tr)
  }
}

// Akıllı yapıştırma: formül/kod algılama, Cmd+Z ile ham metne dönüş, Cmd+Shift+V ile ham yapıştırma
export const SmartPaste = Extension.create<object, SmartPasteStorage>({
  name: 'smartPaste',
  priority: 1000,

  addStorage() {
    return { last: null, suggestions: new Set<string>() }
  },

  onTransaction({ transaction }) {
    // yapıştırmadan sonra başka bir değişiklik olduysa "ham metne dön" geçersizleşir
    if (transaction.docChanged && !transaction.getMeta('smartPaste')) this.storage.last = null
  },

  addKeyboardShortcuts() {
    return {
      'Mod-z': () => {
        const last = this.storage.last
        if (!last) return false
        this.storage.last = null
        const { state } = this.editor
        const to = Math.min(last.to, state.doc.content.size)
        const tr = state.tr
        tr.setMeta('smartPaste', true)
        // ham metin değişimi geçmişe yazılmaz: ikinci Cmd+Z yapıştırmayı tamamen geri alır
        tr.setMeta('addToHistory', false)
        const nodes = rawParagraphs(last.raw).map((j) => state.schema.nodeFromJSON(j))
        tr.replaceWith(last.from, to, nodes)
        this.editor.view.dispatch(tr)
        return true
      },
      'Mod-Shift-v': () => {
        void navigator.clipboard.readText().then((text) => insertRaw(this.editor, text))
        return true
      }
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    const storage = this.storage
    return [
      new Plugin({
        key: new PluginKey('smartPaste'),
        props: {
          handlePaste: (view, event) => {
            const data = event.clipboardData
            if (!data) return false
            const text = data.getData('text/plain')
            const html = data.getData('text/html')
            // yalnızca görsel varsa görsel bloğu
            const images = Array.from(data.files).filter((f) => f.type.startsWith('image/'))
            if (images.length && !text) {
              void insertImageFiles(view, images)
              return true
            }
            if (!text && !html) return false
            // kod bloğunda her zaman ham metin
            if (editor.isActive('codeBlock')) {
              view.dispatch(view.state.tr.insertText(text))
              return true
            }
            const result = convertPaste({ text, html: html || undefined }, useStore.getState().settings.paste)
            const from = view.state.selection.from
            const content = result.doc.content ?? []
            editor
              .chain()
              .command(({ tr }) => {
                tr.setMeta('smartPaste', true)
                return true
              })
              .insertContent(content)
              .run()
            storage.last = { from, to: editor.state.selection.to, raw: text }
            for (const s of result.suggestions) storage.suggestions.add(s.line)
            if (result.suggestions.length) view.dispatch(view.state.tr.setMeta(suggestKey, 'refresh').setMeta('smartPaste', true))
            if (result.warnings.some((w) => w.kind === 'invalid-latex')) {
              const n = result.warnings.filter((w) => w.kind === 'invalid-latex').length
              useStore.getState().toast(`${n} formül doğrulanamadı, metin olarak bırakıldı`)
            }
            void downloadRemoteImages(editor, result.doc)
            window.dispatchEvent(new CustomEvent('kernel:tip', { detail: 'first-paste' }))
            return true
          }
        }
      }),
      // "Formüle çevir" önerisi: metni öneri listesindeki satırla aynı olan paragraflar
      new Plugin({
        key: suggestKey,
        props: {
          decorations: (state) => {
            if (!storage.suggestions.size) return null
            const decos: Decoration[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'paragraph') return
              const line = node.textContent.trim()
              if (!storage.suggestions.has(line)) return false
              decos.push(
                Decoration.widget(pos + node.nodeSize - 1, () => {
                  const chip = document.createElement('button')
                  chip.className = 'suggest-math'
                  chip.dataset['testid'] = 'suggest-math'
                  chip.textContent = 'Formüle çevir'
                  chip.onmousedown = (e) => e.preventDefault()
                  chip.onclick = () => {
                    storage.suggestions.delete(line)
                    const tr = editor.state.tr.replaceWith(pos, pos + node.nodeSize, editor.schema.nodes['blockMath']!.create({ latex: line }))
                    editor.view.dispatch(tr)
                  }
                  return chip
                }, { side: 1 })
              )
              return false
            })
            return DecorationSet.create(state.doc, decos)
          }
        }
      })
    ]
  }
})
