import { Node, mergeAttributes, type AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import CodeBlock from '@tiptap/extension-code-block'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { Mathematics } from '@tiptap/extension-mathematics'
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details'
import Highlight from '@tiptap/extension-highlight'
import { CALLOUT_TYPES } from '@core/markdown/schema'

// Görev 6'daki Markdown şemasıyla birebir aynı düğüm/işaret adları

const alignAttr = {
  align: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.textAlign || null,
    renderHTML: (attrs: { align?: string | null }) => (attrs.align ? { style: `text-align: ${attrs.align}` } : {})
  }
}

export const KernelCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      lineNumbers: { default: false, renderHTML: (a: { lineNumbers?: boolean }) => (a.lineNumbers ? { 'data-line-numbers': '' } : {}) }
    }
  }
})

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      type: { default: 'note' as (typeof CALLOUT_TYPES)[number] },
      icon: { default: null as string | null },
      title: { default: '' }
    }
  },
  parseHTML: () => [{ tag: 'div[data-callout]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-callout': node.attrs['type'], class: `callout callout-${node.attrs['type']}` }), 0]
})

export const KernelImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: '' }, alt: { default: '' }, width: { default: null as number | null }, caption: { default: '' } }
  },
  parseHTML: () => [{ tag: 'figure[data-image]' }],
  renderHTML: ({ node }) => ['figure', { 'data-image': '', class: 'image-block' }, ['img', { src: toVaultUrl(String(node.attrs['src'])), alt: node.attrs['alt'] }], ['figcaption', {}, String(node.attrs['caption'] ?? '')]]
})

/** attachments/… yolunu kernel-file:// adresine çevirir; http(s) ve data: olduğu gibi kalır */
export function toVaultUrl(src: string): string {
  if (/^(https?:|data:|kernel-file:)/.test(src)) return src
  return `kernel-file://vault/${src.split('/').map(encodeURIComponent).join('/')}`
}

export interface ExtensionOptions {
  placeholder?: string
}

export function buildExtensions(opts: ExtensionOptions = {}): AnyExtension[] {
  return [
    StarterKit.configure({ codeBlock: false, heading: { levels: [1, 2, 3, 4, 5, 6] }, link: { openOnClick: false, autolink: true } }),
    KernelCodeBlock,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader.extend({
      addAttributes() {
        return { ...this.parent?.(), ...alignAttr }
      }
    }),
    TableCell.extend({
      addAttributes() {
        return { ...this.parent?.(), ...alignAttr }
      }
    }),
    Highlight.configure({ multicolor: true }),
    Mathematics.configure({ katexOptions: { throwOnError: false } }),
    Details.configure({ persist: false, HTMLAttributes: { class: 'details' } }).extend({
      addAttributes() {
        return { ...this.parent?.(), card: { default: false, renderHTML: (a: { card?: boolean }) => (a.card ? { 'data-card': '' } : {}) } }
      }
    }),
    DetailsSummary,
    DetailsContent,
    Callout,
    KernelImage,
    Placeholder.configure({ placeholder: opts.placeholder ?? 'Yazmaya başla ya da / yaz' })
  ]
}
