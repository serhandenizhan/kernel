// SENTETİK Notion API nesneleri üreticileri (gerçek kullanıcı verisi DEĞİL; konu: gezegenler, algoritmalar)
import type { NotionBlock, NotionPage, NotionRichText } from '../../../src/core/notion/types'

let seq = 0
const id = (p: string) => `${p}-${String(++seq).padStart(4, '0')}`

export const ann = (a: Partial<NotionRichText['annotations']> = {}) => ({ bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default', ...a })
export const t = (content: string, a: Partial<NotionRichText['annotations']> = {}, link?: string): NotionRichText => ({
  type: 'text',
  plain_text: content,
  href: link ?? null,
  annotations: ann(a),
  text: { content, link: link ? { url: link } : null }
})
export const eq = (expression: string): NotionRichText => ({ type: 'equation', plain_text: expression, href: null, annotations: ann(), equation: { expression } })
export const mentionPage = (pageId: string, plain: string): NotionRichText => ({ type: 'mention', plain_text: plain, href: null, annotations: ann(), mention: { type: 'page', page: { id: pageId } } })
export const mentionDate = (start: string): NotionRichText => ({ type: 'mention', plain_text: start, href: null, annotations: ann(), mention: { type: 'date', date: { start } } })

export function block(type: string, data: Record<string, unknown> = {}, children?: NotionBlock[]): NotionBlock {
  return { id: id('blk'), type, has_children: Boolean(children?.length), [type]: data, ...(children ? { children } : {}) }
}
export const para = (...rt: NotionRichText[]) => block('paragraph', { rich_text: rt, color: 'default' })
export const h = (level: 1 | 2 | 3, text: string, toggleable = false, children?: NotionBlock[]) => block(`heading_${level}`, { rich_text: [t(text)], is_toggleable: toggleable, color: 'default' }, children)
export const bullet = (text: string, children?: NotionBlock[]) => block('bulleted_list_item', { rich_text: [t(text)], color: 'default' }, children)
export const numbered = (text: string) => block('numbered_list_item', { rich_text: [t(text)], color: 'default' })
export const todo = (text: string, checked: boolean) => block('to_do', { rich_text: [t(text)], checked, color: 'default' })
export const toggle = (text: string, children: NotionBlock[]) => block('toggle', { rich_text: [t(text)], color: 'default' }, children)
export const quote = (text: string) => block('quote', { rich_text: [t(text)], color: 'default' })
export const callout = (text: string, color: string, emoji: string | null = '💡') => block('callout', { rich_text: [t(text)], color, icon: emoji ? { type: 'emoji', emoji } : null })
export const code = (text: string, language: string) => block('code', { rich_text: [t(text)], language, caption: [] })
export const equation = (expression: string) => block('equation', { expression })
export const divider = () => block('divider', {})
export const image = (url: string, caption = '') => block('image', { type: 'file', file: { url, expiry_time: '2026-11-04T12:00:00.000Z' }, caption: caption ? [t(caption)] : [] })
export const pdf = (url: string) => block('pdf', { type: 'file', file: { url }, caption: [] })
export const bookmark = (url: string) => block('bookmark', { url, caption: [] })
export const childPage = (pageId: string, title: string): NotionBlock => ({ id: pageId, type: 'child_page', has_children: true, child_page: { title } })
export const linkToPage = (pageId: string) => block('link_to_page', { type: 'page_id', page_id: pageId })
export const columns = (...cols: NotionBlock[][]) => block('column_list', {}, cols.map((c) => block('column', {}, c)))
export const table = (rows: string[][]) => block('table', { table_width: rows[0]!.length, has_column_header: true, has_row_header: false }, rows.map((r) => block('table_row', { cells: r.map((c) => [t(c)]) })))
export const unsupported = (type = 'ai_block') => block(type, {})

export function page(pageId: string, title: string, opts: { parent?: string; emoji?: string; cover?: string } = {}): NotionPage {
  return {
    id: pageId,
    object: 'page',
    parent: opts.parent ? { type: 'page_id', page_id: opts.parent } : { type: 'workspace' },
    icon: opts.emoji ? { type: 'emoji', emoji: opts.emoji } : null,
    cover: opts.cover ? { type: 'external', external: { url: opts.cover } } : null,
    properties: { title: { type: 'title', title: title ? [t(title)] : [] } }
  }
}
