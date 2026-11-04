import { Node, mergeAttributes } from '@tiptap/core'
import { resolveWikiTarget } from '@core/wiki'
import { useStore } from '../../state/store'

/** [[Hedef]] linkini açar; bulunamazsa uyarır */
export function openWikiTarget(target: string): void {
  const s = useStore.getState()
  const id = resolveWikiTarget(s.tree, target)
  if (id) s.openPage(id)
  else s.toast(`Sayfa bulunamadı: ${target}`, 'error')
}

// [[Sayfa adı]] / [[Sayfa adı|görünen ad]]: tıklanabilir iç link (Faz 3'te seçici ve geri bağlantılar eklenecek)
export const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { target: { default: '' }, label: { default: null as string | null } }
  },
  parseHTML: () => [{ tag: 'a[data-wiki]' }],
  renderHTML: ({ node, HTMLAttributes }) => [
    'a',
    mergeAttributes(HTMLAttributes, { 'data-wiki': node.attrs['target'], class: 'wiki-link', title: String(node.attrs['target']) }),
    String(node.attrs['label'] ?? node.attrs['target'])
  ],
  renderText: ({ node }) => String(node.attrs['label'] ?? node.attrs['target']),
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('a')
      dom.className = 'wiki-link'
      dom.dataset['wiki'] = String(node.attrs['target'])
      dom.title = String(node.attrs['target'])
      dom.textContent = String(node.attrs['label'] ?? node.attrs['target'])
      dom.addEventListener('mousedown', (e) => e.preventDefault())
      dom.addEventListener('click', (e) => {
        e.preventDefault()
        openWikiTarget(String(node.attrs['target']))
      })
      return { dom }
    }
  }
})

// Gömülü PDF düğümü (görüntüleyici PdfEmbed görünümüyle değiştirilir)
export const PdfEmbedSchema = Node.create({
  name: 'pdfEmbed',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: '' } }
  },
  parseHTML: () => [{ tag: 'div[data-pdf]' }],
  renderHTML: ({ node }) => ['div', { 'data-pdf': node.attrs['src'], class: 'pdf-card' }, `📄 ${String(node.attrs['src']).split('/').pop()}`]
})
