import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CALLOUT_TYPES, type CalloutType } from '@core/markdown/schema'
import { CalloutView } from '../ui/CalloutView'
import { tNow } from '../../lib/i18n'
import type { MessageKey } from '@shared/i18n'

export const CALLOUT_DEFAULT_ICON: Record<CalloutType, string> = { note: '📝', tip: '💡', warning: '⚠️', danger: '🚫', info: 'ℹ️', example: '🧪' }
/** Callout türünün o anki dildeki adı (yeni başlıklar oluşturulduğu dilde yazılır) */
export const calloutLabel = (type: CalloutType): string => tNow(`callout.${type}` as MessageKey)

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      type: { default: 'note' as CalloutType },
      icon: { default: null as string | null },
      title: { default: '' }
    }
  },
  parseHTML: () => [{ tag: 'div[data-callout]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-callout': node.attrs['type'], class: `callout callout-${node.attrs['type']}` }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  }
})

export { CALLOUT_TYPES }
