import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { TAG } from '@core/links'

function decorate(doc: PMNode): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos, parent) => {
    if (!node.isText || !node.text || parent?.type.spec.code) return
    if (node.marks.some((m) => m.type.name === 'code')) return
    for (const m of node.text.matchAll(TAG)) {
      const from = pos + m.index! + m[1]!.length
      decos.push(Decoration.inline(from, from + 1 + m[2]!.length, { class: 'hashtag' }))
    }
  })
  return DecorationSet.create(doc, decos)
}

// Metindeki #etiketleri vurgular; dosyada düz metin olarak kalır
export const TagHighlight = Extension.create({
  name: 'tagHighlight',
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>('tagHighlight')
    return [
      new Plugin({
        key,
        state: {
          init: (_c, state) => decorate(state.doc),
          apply: (tr, old) => (tr.docChanged ? decorate(tr.doc) : old)
        },
        props: { decorations: (state) => key.getState(state) }
      })
    ]
  }
})
