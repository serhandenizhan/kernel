// Ana süreç, preload ve arayüz arasında paylaşılan tipler

export interface PageMeta {
  id: string
  icon?: string
  cover?: string
  coverPosition?: number
  created: string
  updated: string
  tags?: string[]
}

export interface TreeNode {
  id: string
  title: string
  /** Kasaya göre göreli yol, örn. "Lineer Cebir/Özdeğerler.md" */
  path: string
  icon?: string
  children: TreeNode[]
}

export interface PageData {
  id: string
  title: string
  path: string
  meta: PageMeta
  markdown: string
  /** Bozuk frontmatter ya da ikili veri: dosyayı korumak için düzenlenemez */
  readOnly?: boolean
}

export interface SearchHit {
  id: string
  title: string
  path: string
  snippet: string
  score: number
}

export interface HistoryEntry {
  /** "20261104T101500123" (UTC) */
  versionId: string
  time: string
  size: number
}

export interface PdfOptions {
  pageSize: 'A4' | 'Letter'
  margin: 'narrow' | 'normal' | 'wide'
  showCover: boolean
  pageNumbers: boolean
  includeSubpages: boolean
  theme: 'light' | 'dark'
}

export interface PasteSettings {
  stripCitations: boolean
  latexLineHeuristic: boolean
  unfencedCodeHeuristic: boolean
}

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  bodyFont: 'serif' | 'sans'
  pageWidth: 'narrow' | 'normal' | 'wide'
  paste: PasteSettings
  tips: { enabled: boolean; seen: string[] }
  tourDone: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  bodyFont: 'serif',
  pageWidth: 'normal',
  paste: { stripCitations: true, latexLineHeuristic: true, unfencedCodeHeuristic: true },
  tips: { enabled: true, seen: [] },
  tourDone: false
}

export interface KernelApi {
  vault: {
    info(): Promise<{ path: string } | null>
    choose(create?: boolean): Promise<{ path: string } | null>
    reveal(id: string): Promise<void>
  }
  pages: {
    tree(): Promise<TreeNode[]>
    read(id: string): Promise<PageData>
    write(id: string, input: { markdown: string; meta: PageMeta }): Promise<{ updated: string }>
    create(parentId: string | null, title?: string): Promise<TreeNode>
    rename(id: string, title: string): Promise<TreeNode>
    move(id: string, parentId: string | null, index: number): Promise<void>
    trash(id: string): Promise<void>
  }
  attachments: {
    save(bytes: Uint8Array, ext: string, nameHint?: string): Promise<string>
    fetchRemote(url: string): Promise<string | null>
  }
  search: {
    query(q: string, limit?: number): Promise<SearchHit[]>
    recent(): Promise<TreeNode[]>
  }
  pdf: {
    export(id: string, options: PdfOptions): Promise<{ filePath: string } | { canceled: true }>
  }
  history: {
    list(id: string): Promise<HistoryEntry[]>
    /** Sürümün gövde Markdown'ı (frontmatter hariç) */
    read(id: string, versionId: string): Promise<string>
    restore(id: string, versionId: string): Promise<void>
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  /** cb: kaydedilmemiş değişiklik kalmadıysa true */
  app: { onFlushRequest(cb: () => Promise<boolean>): void }
  events: {
    onTreeChanged(cb: () => void): () => void
    onPageChangedExternally(cb: (id: string) => void): () => void
  }
}
