import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

/** Tek içeriği bir sayfa linki olan paragraflara "page-row" sınıfı (Notion alt sayfa listeleri gibi); yalnızca görünüm */
function decorate(doc: PMNode): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return
    if (node.childCount === 1 && node.firstChild!.type.name === 'wikiLink') decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'page-row' }))
    return false
  })
  return DecorationSet.create(doc, decos)
}

export const PageRow = Extension.create({
  name: 'pageRow',
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>('pageRow')
    return [
      new Plugin({
        key,
        state: {
          init: (_, state) => decorate(state.doc),
          apply: (tr, old) => (tr.docChanged ? decorate(tr.doc) : old)
        },
        props: { decorations: (state) => key.getState(state) }
      })
    ]
  }
})
