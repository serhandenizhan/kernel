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

/** Ana sayfa için sayfa özeti (frontmatter tarihleri ve kapakla) */
export interface PageSummary {
  id: string
  title: string
  path: string
  parentId: string | null
  icon?: string
  cover?: string
  created?: string
  updated?: string
  childCount: number
}

export interface HomeItem {
  id: string
  title: string
  icon?: string
  /** en üst seviyedeki atanın (dersin) başlığı; üst seviye sayfada yok */
  parentTitle?: string
  /** ilgili tarih (ISO): düzenlenme ya da oluşturulma */
  at?: string
}

export interface HomeCourse {
  id: string
  title: string
  icon?: string
  cover?: string
  childCount: number
  descendantCount: number
  /** alt sayfalar dahil en yeni düzenleme */
  lastUpdated?: string
}

export interface HomeData {
  courses: HomeCourse[]
  pins: HomeItem[]
  recentEdited: HomeItem[]
  recentAdded: HomeItem[]
  /** tam 84 gün, bugünle biter, eskiden yeniye */
  activity: { day: string; count: number }[]
  totalPages: number
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

export interface ImportReport {
  rootPageId: string
  pages: number
  files: number
  failedFiles: { page: string; url: string }[]
  unsupported: { page: string; type: string }[]
  notes: string[]
  mismatches: { page: string; notion: number; kernel: number }[]
  /** Notion'dan okunamayan sayfalar (aktarım bunları atlayıp sürer) */
  failedPages: { page: string; error: string }[]
}

export type ImportProgress = { phase: 'scanning' | 'importing' | 'done' | 'error' | 'canceled'; pagesDone: number; pagesTotal: number; current?: string; report?: ImportReport; error?: string }

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

/** Arayüz dili */
export type Lang = 'tr' | 'en' | 'de'

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  bodyFont: 'serif' | 'sans'
  pageWidth: 'narrow' | 'normal' | 'wide'
  paste: PasteSettings
  tips: { enabled: boolean; seen: string[] }
  tourDone: boolean
  backup: { enabled: boolean; folder: string | null; keep: number }
  /** 'system': macOS dili (tr/en/de değilse Türkçe) */
  language: Lang | 'system'
  /** açılışta ana sayfa ya da son açık sayfa */
  startView: 'home' | 'last'
  /** ayar dosyası şema sürümü (göçler için) */
  schema: number
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  bodyFont: 'sans',
  pageWidth: 'normal',
  paste: { stripCitations: true, latexLineHeuristic: true, unfencedCodeHeuristic: true },
  tips: { enabled: true, seen: [] },
  tourDone: false,
  backup: { enabled: false, folder: null, keep: 14 },
  language: 'system',
  startView: 'home',
  schema: 2
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
  exportAs: {
    markdown(id: string, includeSubpages: boolean): Promise<{ filePath: string } | { canceled: true }>
    html(id: string, options: PdfOptions): Promise<{ filePath: string } | { canceled: true }>
  }
  history: {
    list(id: string): Promise<HistoryEntry[]>
    /** Sürümün gövde Markdown'ı (frontmatter hariç) */
    read(id: string, versionId: string): Promise<string>
    restore(id: string, versionId: string): Promise<void>
  }
  notion: {
    connect(token: string): Promise<{ ok: true; workspace: string } | { ok: false; error: string }>
    connected(): Promise<boolean>
    disconnect(): Promise<void>
    pages(): Promise<{ id: string; title: string; icon?: string }[]>
    start(ids: string[]): Promise<void>
    resume(): Promise<void>
    cancel(): Promise<void>
    pendingResume(): Promise<boolean>
    onProgress(cb: (p: ImportProgress) => void): () => void
  }
  /** [[link]] dizini (spec §12) */
  links: {
    backlinks(id: string): Promise<Backlink[]>
    graph(): Promise<GraphData>
  }
  tags: {
    list(): Promise<TagCount[]>
    pages(tag: string): Promise<{ id: string; title: string }[]>
  }
  /** ana sayfa verisi (spec §18.2) */
  home: { data(): Promise<HomeData> }
  /** sabitlenen sayfalar (.kernel/pins.json) */
  pins: {
    list(): Promise<string[]>
    set(ids: string[]): Promise<void>
  }
  templates: {
    list(): Promise<string[]>
    create(parentId: string | null, name: string): Promise<TreeNode>
    saveAs(id: string, name: string): Promise<string>
  }
  backup: {
    now(): Promise<{ filePath: string } | { error: string }>
    status(): Promise<{ last: string | null }>
    chooseFolder(): Promise<string | null>
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<Settings>
  }
  /** cb: kaydedilmemiş değişiklik kalmadıysa true */
  app: {
    onFlushRequest(cb: () => Promise<boolean>): void
    /** macOS sistem dili (örn. "tr-TR") */
    locale(): Promise<string>
  }
  events: {
    onTreeChanged(cb: () => void): () => void
    onPageChangedExternally(cb: (id: string) => void): () => void
    /** Ana süreçten gelen bildirim (örn. otomatik yedek hatası) */
    onToast(cb: (message: string, kind: 'info' | 'error') => void): () => void
    /** ana sayfa verisi değişti (500 ms içinde birleştirilmiş) */
    onHomeChanged(cb: () => void): () => void
    /** link / etiket dizini değişti (500 ms içinde birleştirilmiş) */
    onLinksChanged(cb: () => void): () => void
    /** uygulama menüsünden gelen komut */
    onMenuCommand(cb: (cmd: 'settings' | 'toggle-sidebar' | 'toggle-toc') => void): () => void
  }
}

/** Bir sayfaya bağlanan sayfa ve linkin geçtiği cümle */
export interface Backlink {
  id: string
  title: string
  context: string
}

export interface GraphData {
  nodes: { id: string; title: string; folder: string; tags: string[] }[]
  links: { source: string; target: string }[]
}

export interface TagCount {
  tag: string
  count: number
}
