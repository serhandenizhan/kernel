import { Node, mergeAttributes } from '@tiptap/core'
import { resolveWikiTarget } from '@core/wiki'
import { useStore } from '../../state/store'
import { tNow } from '../../lib/i18n'
import { toVaultUrl } from '@core/vault-url'
import { kernel } from '../../lib/kernel'
import type { TreeNode } from '@shared/types'

// ikonu olmayan sayfa için ince belge ikonu (ikon setindeki "doc" ile aynı çizim)
const DOC_ICON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 1.8h5.2L12 4.6V14a.6.6 0 0 1-.6.6H4a.6.6 0 0 1-.6-.6V2.4a.6.6 0 0 1 .6-.6zM9 1.9v2.9h2.9" stroke-linejoin="round"/></svg>'

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const c = findNode(n.children, id)
    if (c) return c
  }
  return null
}

/** [[Hedef]] linkini açar; sayfa yoksa oluşturur (spec §12). "Üst/Ad" biçiminde üst sayfa varsa altına açılır. */
export async function openWikiTarget(target: string): Promise<void> {
  const s = useStore.getState()
  const id = resolveWikiTarget(s.tree, target)
  if (id) return s.openPage(id)
  const parts = target.split('/').map((p) => p.trim()).filter(Boolean)
  const title = parts.pop()
  if (!title) return s.toast(tNow('editor.pageNotFound', { target }), 'error')
  const parentId = parts.length ? resolveWikiTarget(s.tree, parts.join('/')) : null
  try {
    const node = await kernel.pages.create(parentId, title)
    await s.refreshTree()
    s.openPage(node.id)
  } catch {
    s.toast(tNow('editor.pageNotFound', { target }), 'error')
  }
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
      const target = String(node.attrs['target'])
      const dom = document.createElement('a')
      dom.className = 'wiki-link'
      dom.dataset['wiki'] = target
      dom.title = target
      const icon = document.createElement('span')
      icon.className = 'wiki-icon'
      icon.setAttribute('aria-hidden', 'true')
      const label = document.createElement('span')
      label.className = 'wiki-label'
      label.textContent = String(node.attrs['label'] ?? target)
      dom.append(icon, label)
      // hedefin ikonu ağaçtan okunur; ağaç değişince (yeniden adlandırma, ikon) güncellenir
      const render = () => {
        const tree = useStore.getState().tree
        const id = resolveWikiTarget(tree, target)
        const page = id ? findNode(tree, id) : null
        dom.classList.toggle('missing', !page)
        icon.replaceChildren()
        if (!page) {
          icon.hidden = true
          return
        }
        icon.hidden = false
        if (page.icon?.startsWith('attachments/')) {
          const img = document.createElement('img')
          img.src = toVaultUrl(page.icon)
          img.alt = ''
          icon.append(img)
        } else if (page.icon) {
          icon.textContent = page.icon
        } else {
          icon.innerHTML = DOC_ICON
        }
      }
      render()
      let lastTree = useStore.getState().tree
      const unsubscribe = useStore.subscribe((s) => {
        if (s.tree !== lastTree) {
          lastTree = s.tree
          render()
        }
      })
      dom.addEventListener('mousedown', (e) => e.preventDefault())
      dom.addEventListener('click', (e) => {
        e.preventDefault()
        void openWikiTarget(target)
      })
      return { dom, destroy: unsubscribe }
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
