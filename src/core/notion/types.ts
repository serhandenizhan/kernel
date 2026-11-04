// Notion API'nin Kernel'in kullandığı asgari tipleri (Notion-Version 2022-06-28)

export interface NotionAnnotations {
  bold: boolean
  italic: boolean
  strikethrough: boolean
  underline: boolean
  code: boolean
  color: string
}

export interface NotionRichText {
  type: 'text' | 'mention' | 'equation'
  plain_text: string
  href: string | null
  annotations: NotionAnnotations
  text?: { content: string; link: { url: string } | null }
  mention?: {
    type: 'page' | 'database' | 'date' | 'user' | 'link_preview' | 'template_mention'
    page?: { id: string }
    database?: { id: string }
    date?: { start: string; end?: string | null }
    user?: { name?: string | null }
  }
  equation?: { expression: string }
}

export interface NotionFile {
  type: 'file' | 'external'
  file?: { url: string; expiry_time?: string }
  external?: { url: string }
  caption?: NotionRichText[]
  name?: string
}

export type NotionIcon = { type: 'emoji'; emoji: string } | ({ type: 'file' | 'external' } & NotionFile) | null

export interface NotionBlock {
  id: string
  type: string
  has_children: boolean
  /** Aktarıcı tarafından doldurulur (özyinelemeli çocuklar) */
  children?: NotionBlock[]
  [key: string]: unknown
}

export interface NotionPage {
  id: string
  object: 'page'
  parent: { type: 'page_id' | 'workspace' | 'database_id' | 'block_id'; page_id?: string; database_id?: string; block_id?: string }
  icon: NotionIcon
  cover: NotionFile | null
  properties: Record<string, { type: string; [key: string]: unknown }>
}

export interface NotionList<T> {
  results: T[]
  next_cursor: string | null
}
