import type { JSONContent } from '@tiptap/core'
import { normalizeLanguage } from '../smart-paste/language'
import type { NotionBlock, NotionFile, NotionPage, NotionRichText } from './types'
import { plainText, richTextToInline } from './rich-text'

export interface ConvertContext {
  /** İndirildiyse kasadaki attachments yolu */
  file(url: string): string | null
  /** Aktarılan sayfanın Kernel'deki (benzersiz) başlığı ya da wiki hedefi */
  pageTitle(notionId: string): string | null
  report(e: { kind: 'unsupported' | 'flattened' | 'file-failed'; detail: string }): void
}

/** child_database blokları için aktarıcının eklediği tablo verisi */
export interface DatabaseData {
  title: string
  columns: string[]
  rows: string[][]
}

// Notion callout rengi → Kernel callout türü
export const CALLOUT_COLOR_MAP: Record<string, string> = { green: 'tip', blue: 'info', yellow: 'warning', orange: 'warning', red: 'danger', pink: 'danger', purple: 'example' }

const IGNORED = new Set(['table_of_contents', 'breadcrumb', 'column', 'table_row'])
const data = (b: NotionBlock) => (b[b.type] ?? {}) as Record<string, unknown>
const rt = (b: NotionBlock) => data(b)['rich_text'] as NotionRichText[] | undefined
const para = (content: JSONContent[]): JSONContent => (content.length ? { type: 'paragraph', content } : { type: 'paragraph' })
const link = (text: string, href: string): JSONContent => ({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] })
const fileUrl = (f: NotionFile | undefined) => f?.file?.url ?? f?.external?.url ?? null

function codeLanguage(lang: unknown): string | null {
  const l = String(lang ?? '').toLowerCase().trim()
  if (!l || l === 'plain text') return null
  return normalizeLanguage(l.replace(/\s+/g, ''))
}

function listKind(type: string): 'bulletList' | 'orderedList' | 'taskList' | null {
  if (type === 'bulleted_list_item') return 'bulletList'
  if (type === 'numbered_list_item') return 'orderedList'
  if (type === 'to_do') return 'taskList'
  return null
}

function itemContent(b: NotionBlock, ctx: ConvertContext): JSONContent[] {
  return [para(richTextToInline(rt(b), ctx)), ...convertBlocks(b.children ?? [], ctx)]
}

function fileBlock(b: NotionBlock, ctx: ConvertContext): JSONContent[] {
  const f = data(b) as unknown as NotionFile
  const url = fileUrl(f)
  if (!url) return []
  if (b.type === 'video' && f.type === 'external') return [para([{ type: 'text', text: '🔗 ' }, link(url, url)])]
  const local = ctx.file(url)
  if (!local) {
    ctx.report({ kind: 'file-failed', detail: url })
    return [para([{ type: 'text', text: b.type === 'image' ? '🖼 ' : '📎 ' }, link(url, url)])]
  }
  if (b.type === 'image') return [{ type: 'image', attrs: { src: local, alt: '', width: null, caption: plainText(f.caption) } }]
  if (b.type === 'pdf') return [{ type: 'pdfEmbed', attrs: { src: local } }]
  const name = f.name || local.split('/').pop() || 'dosya'
  return [para([{ type: 'text', text: '📎 ' }, link(name, local)])]
}

function convertOne(b: NotionBlock, ctx: ConvertContext): JSONContent[] {
  const d = data(b)
  const children = () => convertBlocks(b.children ?? [], ctx)
  switch (b.type) {
    case 'paragraph':
      return [para(richTextToInline(rt(b), ctx)), ...children()]
    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const level = Number(b.type.slice(-1))
      const inline = richTextToInline(rt(b), ctx)
      if (d['is_toggleable']) {
        const inner = children()
        return [{ type: 'details', attrs: { card: false, heading: level }, content: [inline.length ? { type: 'detailsSummary', content: inline } : { type: 'detailsSummary' }, { type: 'detailsContent', content: inner.length ? inner : [para([])] }] }]
      }
      return [inline.length ? { type: 'heading', attrs: { level }, content: inline } : { type: 'heading', attrs: { level } }]
    }
    case 'toggle': {
      const inline = richTextToInline(rt(b), ctx)
      const inner = children()
      return [{ type: 'details', attrs: { card: false, heading: null }, content: [inline.length ? { type: 'detailsSummary', content: inline } : { type: 'detailsSummary' }, { type: 'detailsContent', content: inner.length ? inner : [para([])] }] }]
    }
    case 'quote':
      return [{ type: 'blockquote', content: itemContent(b, ctx) }]
    case 'callout': {
      const color = String(d['color'] ?? 'default').replace('_background', '')
      const icon = d['icon'] as { type: string; emoji?: string } | null
      return [{ type: 'callout', attrs: { type: CALLOUT_COLOR_MAP[color] ?? 'note', icon: icon?.type === 'emoji' ? (icon.emoji ?? null) : null, title: '' }, content: itemContent(b, ctx) }]
    }
    case 'code': {
      const text = plainText(rt(b))
      const node: JSONContent = { type: 'codeBlock', attrs: { language: codeLanguage(d['language']), lineNumbers: false } }
      if (text) node.content = [{ type: 'text', text }]
      return [node]
    }
    case 'equation':
      return [{ type: 'blockMath', attrs: { latex: String(d['expression'] ?? '') } }]
    case 'divider':
      return [{ type: 'horizontalRule' }]
    case 'image':
    case 'file':
    case 'pdf':
    case 'video':
    case 'audio':
      return fileBlock(b, ctx)
    case 'bookmark':
    case 'embed':
    case 'link_preview': {
      const url = String(d['url'] ?? '')
      if (!url) return []
      const caption = plainText(d['caption'] as NotionRichText[] | undefined)
      return [para([{ type: 'text', text: '🔗 ' }, link(caption || url, url)])]
    }
    case 'table': {
      const rows = (b.children ?? []).filter((r) => r.type === 'table_row')
      if (!rows.length) return []
      return [
        {
          type: 'table',
          content: rows.map((r, i) => ({
            type: 'tableRow',
            content: ((data(r)['cells'] as NotionRichText[][]) ?? []).map((cell) => ({ type: i === 0 ? 'tableHeader' : 'tableCell', attrs: { align: null }, content: [para(richTextToInline(cell, ctx))] }))
          }))
        }
      ]
    }
    case 'child_page':
      return [para([{ type: 'wikiLink', attrs: { target: ctx.pageTitle(b.id) ?? String(d['title'] ?? 'Adsız'), label: null } }])]
    case 'child_database': {
      const db = b['database'] as DatabaseData | undefined
      const title = db?.title || String(d['title'] ?? 'Veritabanı')
      const head = para([{ type: 'text', text: title, marks: [{ type: 'bold' }] }])
      if (!db || !db.columns.length) return [head]
      const row = (cells: string[], header: boolean): JSONContent => ({
        type: 'tableRow',
        content: cells.map((c) => ({ type: header ? 'tableHeader' : 'tableCell', attrs: { align: null }, content: [para(c ? [{ type: 'text', text: c }] : [])] }))
      })
      return [head, { type: 'table', content: [row(db.columns, true), ...db.rows.map((r) => row(r, false))] }]
    }
    case 'link_to_page': {
      const target = ctx.pageTitle(String(d['page_id'] ?? d['database_id'] ?? ''))
      return [para(target ? [{ type: 'wikiLink', attrs: { target, label: null } }] : [{ type: 'text', text: 'Notion sayfası (aktarılmadı)' }])]
    }
    case 'column_list':
      ctx.report({ kind: 'flattened', detail: 'column_list' })
      return (b.children ?? []).flatMap((col) => convertBlocks(col.children ?? [], ctx))
    case 'synced_block':
      return children()
    default:
      if (IGNORED.has(b.type)) return []
      ctx.report({ kind: 'unsupported', detail: b.type })
      return [para([{ type: 'text', text: `[Desteklenmeyen Notion bloğu: ${b.type}]` }])]
  }
}

// Notion blokları (çocukları doldurulmuş) → Kernel belge düğümleri; ardışık liste öğeleri tek listede toplanır
export function convertBlocks(blocks: NotionBlock[], ctx: ConvertContext): JSONContent[] {
  const out: JSONContent[] = []
  let i = 0
  while (i < blocks.length) {
    const kind = listKind(blocks[i]!.type)
    if (!kind) {
      out.push(...convertOne(blocks[i]!, ctx))
      i++
      continue
    }
    const items: JSONContent[] = []
    while (i < blocks.length && listKind(blocks[i]!.type) === kind) {
      const b = blocks[i]!
      items.push(kind === 'taskList' ? { type: 'taskItem', attrs: { checked: Boolean(data(b)['checked']) }, content: itemContent(b, ctx) } : { type: 'listItem', content: itemContent(b, ctx) })
      i++
    }
    out.push(kind === 'orderedList' ? { type: 'orderedList', attrs: { start: 1 }, content: items } : { type: kind, content: items })
  }
  return out
}

export function pageMeta(page: NotionPage, ctx: ConvertContext): { icon?: string; cover?: string } {
  const out: { icon?: string; cover?: string } = {}
  const icon = page.icon
  if (icon?.type === 'emoji') out.icon = icon.emoji
  else if (icon) {
    const local = ctx.file(fileUrl(icon as NotionFile) ?? '')
    if (local) out.icon = local
  }
  const coverUrl = fileUrl(page.cover ?? undefined)
  if (coverUrl) {
    const local = ctx.file(coverUrl)
    if (local) out.cover = local
  }
  return out
}

export function pageTitleOf(page: NotionPage): string {
  const prop = Object.values(page.properties).find((p) => p.type === 'title') as { title?: NotionRichText[] } | undefined
  return plainText(prop?.title).trim()
}

const CONTAINERS = new Set(['column_list', 'column', 'synced_block'])

/** Notion tarafı içerik birimi sayısı (doğrulama raporu için) */
export function countBlocks(blocks: NotionBlock[]): number {
  let n = 0
  for (const b of blocks) {
    if (IGNORED.has(b.type)) continue
    if (CONTAINERS.has(b.type)) {
      n += countBlocks(b.children ?? [])
      continue
    }
    if (b.type === 'table') {
      n += 1
      continue
    }
    if (b.type === 'child_database') {
      n += (b['database'] as DatabaseData | undefined)?.columns.length ? 2 : 1
      continue
    }
    const empty = b.type === 'paragraph' && !plainText(rt(b)).trim() && !(b.children ?? []).length
    if (!empty) n += 1
    n += countBlocks(b.type === 'child_page' ? [] : (b.children ?? []))
  }
  return n
}

const LEAF = new Set(['heading', 'codeBlock', 'blockMath', 'image', 'pdfEmbed', 'horizontalRule', 'detailsSummary'])

/** Kernel tarafı içerik birimi sayısı */
export function countDocBlocks(doc: JSONContent): number {
  let n = 0
  for (const c of doc.content ?? []) {
    if (c.type === 'table') n += 1
    else if (c.type === 'paragraph') n += c.content?.length ? 1 : 0
    else if (LEAF.has(c.type ?? '')) n += 1
    else n += countDocBlocks(c)
  }
  return n
}
