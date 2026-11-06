import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { cardLineSplit } from '@core/cards'
import { tNow } from '../../lib/i18n'

// "Soru :: Cevap" paragrafları: satır kart olarak işaretlenir, soru / ayraç / cevap ayrı biçimlenir
function decorate(doc: PMNode): DecorationSet {
  const decos: Decoration[] = []
  doc.descendants((node, pos, parent) => {
    if (node.type.spec.code) return false
    // katlanır bloğun düğüm görünümü özel özellikleri DOM'a yazmıyor; kart işareti süsleme ile verilir
    if (node.type.name === 'details' && node.attrs['card']) decos.push(Decoration.node(pos, pos + node.nodeSize, { 'data-card': '' }))
    // kart olarak işaretli katlanır bloğun boş cevabında ipucu
    if (node.type.name === 'paragraph' && node.childCount === 0 && parent?.type.name === 'detailsContent') {
      const $pos = doc.resolve(pos)
      for (let d = $pos.depth; d > 0; d--) {
        const n = $pos.node(d)
        if (n.type.name !== 'details') continue
        if (n.attrs['card']) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'card-empty', 'data-placeholder': tNow('card.answerHint') }))
        break
      }
      return false
    }
    if (node.type.name !== 'paragraph') return true
    const text = node.textContent
    const parts = text.includes('::') ? cardLineSplit(text) : null
    // yalnızca düz metinli satırlarda (konumlar metinle birebir örtüşür)
    if (!parts || node.childCount === 0 || [...Array(node.childCount).keys()].some((i) => !node.child(i).isText)) return false
    const start = pos + 1
    decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'card-line' }))
    decos.push(Decoration.inline(start + parts.qFrom, start + parts.qTo, { class: 'card-q' }))
    decos.push(Decoration.inline(start + parts.sepFrom, start + parts.sepTo, { class: 'card-sep' }))
    decos.push(Decoration.inline(start + parts.aFrom, start + parts.aTo, { class: 'card-a' }))
    return false
  })
  return DecorationSet.create(doc, decos)
}

export const CardHighlight = Extension.create({
  name: 'cardHighlight',
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>('cardHighlight')
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
