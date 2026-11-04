import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { kernel } from '../../lib/kernel'
import { ImageView } from '../ui/ImageView'

import { toVaultUrl } from '@core/vault-url'

export { toVaultUrl }

const extOf = (f: File) => (f.type.split('/')[1] ?? f.name.split('.').pop() ?? 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg')

/** Görsel dosyalarını kasaya kaydedip belgeye ekler */
export async function insertImageFiles(view: EditorView, files: File[], pos?: number): Promise<void> {
  const type = view.state.schema.nodes['image']
  if (!type) return
  let at = pos ?? view.state.selection.from
  for (const f of files) {
    const src = await kernel.attachments.save(new Uint8Array(await f.arrayBuffer()), extOf(f), f.name.replace(/\.[^.]+$/, '') || 'image')
    const node = type.create({ src, alt: '', width: null, caption: '' })
    const tr = view.state.tr.insert(Math.min(at, view.state.doc.content.size), node)
    view.dispatch(tr)
    at += node.nodeSize
  }
}

export const KernelImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: '' }, alt: { default: '' }, width: { default: null as number | null }, caption: { default: '' } }
  },
  parseHTML: () => [{ tag: 'figure[data-image]' }],
  renderHTML: ({ node }) => ['figure', { 'data-image': '', class: 'image-block' }, ['img', { src: toVaultUrl(String(node.attrs['src'])), alt: node.attrs['alt'] }], ['figcaption', {}, String(node.attrs['caption'] ?? '')]],
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          // dosyadan sürükle-bırak
          handleDrop: (view, event) => {
            const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
            if (!files.length) return false
            event.preventDefault()
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
            void insertImageFiles(view, files, pos)
            return true
          }
        }
      })
    ]
  }
})
