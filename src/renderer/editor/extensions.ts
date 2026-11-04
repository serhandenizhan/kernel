import type { AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details'
import Highlight from '@tiptap/extension-highlight'
import { KernelCodeBlock } from './nodes/CodeBlock'
import { KernelMath, MathShortcuts } from './nodes/Math'
import { Callout } from './nodes/Callout'
import { KernelImage } from './nodes/Image'
import { SlashCommand } from './nodes/SlashCommand'
import { SmartPaste } from './paste'
import { WikiLink } from './nodes/WikiLink'
import { PdfEmbed } from './nodes/PdfEmbed'

// Görev 6'daki Markdown şemasıyla birebir aynı düğüm/işaret adları

const alignAttr = {
  align: {
    default: null,
    parseHTML: (el: HTMLElement) => el.style.textAlign || null,
    renderHTML: (attrs: { align?: string | null }) => (attrs.align ? { style: `text-align: ${attrs.align}` } : {})
  }
}

export interface ExtensionOptions {
  placeholder?: string
  /** Salt okunur görünüm (PDF) için düzenleme davranışlarını kapatır */
  readOnly?: boolean
}

export function buildExtensions(opts: ExtensionOptions = {}): AnyExtension[] {
  const list: AnyExtension[] = [
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
    KernelMath,
    Details.configure({ persist: false, HTMLAttributes: { class: 'details' } }).extend({
      addAttributes() {
        return {
          ...this.parent?.(),
          card: { default: false, renderHTML: (a: { card?: boolean }) => (a.card ? { 'data-card': '' } : {}) },
          heading: { default: null, renderHTML: (a: { heading?: number | null }) => (a.heading ? { 'data-heading': String(a.heading) } : {}) }
        }
      }
    }),
    DetailsSummary,
    DetailsContent,
    Callout,
    KernelImage,
    WikiLink,
    PdfEmbed
  ]
  if (!opts.readOnly) list.push(SmartPaste, MathShortcuts, SlashCommand, Placeholder.configure({ placeholder: opts.placeholder ?? 'Yazmaya başla ya da / yaz' }))
  return list
}

export { toVaultUrl } from './nodes/Image'
