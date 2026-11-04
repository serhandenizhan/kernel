import type { JSONContent } from '@tiptap/core'

export type { JSONContent }

// İşaretlerin sabit sırası: hem ayrıştırmada normalizasyon hem serileştirmede iç içe yerleşim için
export const MARK_ORDER = ['link', 'strike', 'bold', 'italic', 'underline', 'highlight', 'code'] as const
export type MarkName = (typeof MARK_ORDER)[number]

export const CALLOUT_TYPES = ['note', 'tip', 'warning', 'danger', 'info', 'example'] as const
export type CalloutType = (typeof CALLOUT_TYPES)[number]

/** Escape edilmiş "\=" için geçici özel karakter (U+E000) */
export const ESCAPED_EQ = ''
