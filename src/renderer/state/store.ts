import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Deck, type Settings, type TreeNode } from '@shared/types'
import { kernel } from '../lib/kernel'

export interface Toast {
  id: number
  message: string
  kind: 'info' | 'error'
}

interface State {
  ready: boolean
  vaultPath: string | null
  tree: TreeNode[]
  currentId: string | null
  settings: Settings
  /** macOS sistem dili (dil ayarı 'system' iken kullanılır) */
  systemLocale: string
  sidebarVisible: boolean
  tocVisible: boolean
  expanded: Record<string, boolean>
  renamingId: string | null
  toasts: Toast[]
  overlay: 'search' | 'settings' | 'export' | 'guide' | 'history' | 'notion' | 'palette' | null
  /** odak modu: kenar çubuğu, içindekiler ve araç çubukları gizli */
  focusMode: boolean
  /** Sayfanın diskten yeniden okunmasını tetikler (örn. sürüm geri yükleme) */
  reloadToken: number
  reloadPage(): void
  init(): Promise<void>
  refreshTree(): Promise<void>
  openPage(id: string | null): void
  /** açık sekmeler (sayfa kimlikleri) ve etkin sekme; tek sekmede çubuk gizli */
  tabs: string[]
  activeTab: number
  /** bölünmüş ekranın sağ bölmesindeki sayfa */
  split: string | null
  openInNewTab(id: string): void
  selectTab(i: number): void
  closeTab(i: number): void
  openSplit(id: string | null): void
  /** sayfa alanında ne gösterilir: ana sayfa ya da açık sayfa */
  view: 'home' | 'page' | 'tag' | 'graph' | 'study'
  /** çalışma ekranı açılınca doğrudan başlatılacak deste */
  studyDeck: Deck | null
  openStudy(deck?: Deck): void
  /** graf görünümü: null = genel graf, kimlik = o sayfanın yerel grafı */
  graphFocus: string | null
  openGraph(focus: string | null): void
  /** etiket görünümünde gösterilen etiket */
  currentTag: string | null
  openTag(tag: string): void
  openHome(): void
  /** sabitlenen sayfa kimlikleri (kullanıcı sırası) */
  pins: string[]
  togglePin(id: string): Promise<void>
  setPins(ids: string[]): Promise<void>
  createPage(parentId: string | null): Promise<void>
  setSettings(patch: Partial<Settings>): Promise<void>
  toggleSidebar(): void
  toggleToc(): void
  toggleFocus(): void
  setExpanded(id: string, open: boolean): void
  setRenaming(id: string | null): void
  setOverlay(o: State['overlay']): void
  toast(message: string, kind?: Toast['kind']): void
}

let toastSeq = 0

const TABS_KEY = (vault: string) => `kernel.tabs:${vault}`
/** Sekmeler oturumlar arası hatırlanır (userData'daki tarayıcı deposu; kasaya yazılmaz) */
function loadTabs(vault: string, tree: TreeNode[]): { tabs: string[]; activeTab: number } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(TABS_KEY(vault)) ?? 'null') as { tabs?: unknown; activeTab?: unknown } | null
    if (!raw || !Array.isArray(raw.tabs)) return null
    const tabs = raw.tabs.filter((x): x is string => typeof x === 'string' && findNode(tree, x) !== null)
    if (tabs.length < 2) return null
    const activeTab = typeof raw.activeTab === 'number' ? Math.max(0, Math.min(raw.activeTab, tabs.length - 1)) : 0
    return { tabs, activeTab }
  } catch {
    return null
  }
}

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const c = findNode(n.children, id)
    if (c) return c
  }
  return null
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  vaultPath: null,
  tree: [],
  currentId: null,
  settings: DEFAULT_SETTINGS,
  systemLocale: 'tr-TR',
  sidebarVisible: true,
  tocVisible: false,
  focusMode: false,
  expanded: {},
  renamingId: null,
  toasts: [],
  overlay: null,
  reloadToken: 0,
  reloadPage: () => set((s) => ({ reloadToken: s.reloadToken + 1 })),

  async init() {
    const [info, systemLocale] = await Promise.all([kernel.vault.info(), kernel.app.locale().catch(() => 'tr-TR')])
    set({ systemLocale })
    if (!info) {
      set({ ready: true, vaultPath: null })
      return
    }
    const [settings, tree, pins, recent] = await Promise.all([kernel.settings.get(), kernel.pages.tree(), kernel.pins.list().catch(() => []), kernel.search.recent().catch(() => [])])
    // son açık sayfa: son açılanlardan ağaçta hâlâ var olan ilki, yoksa ilk sayfa
    const last = recent.find((r) => findNode(tree, r.id))?.id
    const saved = loadTabs(info.path, tree)
    const currentId = saved ? saved.tabs[saved.activeTab]! : (last ?? tree[0]?.id ?? null)
    set({ ready: true, vaultPath: info.path, settings, tree, pins, currentId, ...(saved ?? {}), view: settings.startView === 'home' ? 'home' : 'page' })
  },

  async refreshTree() {
    const [tree, pins] = await Promise.all([kernel.pages.tree(), kernel.pins.list().catch(() => get().pins)])
    const { currentId } = get()
    set({ tree, pins, currentId: currentId && findNode(tree, currentId) ? currentId : (tree[0]?.id ?? null) })
  },

  openPage(id) {
    set({ currentId: id, view: 'page' })
  },

  tabs: [],
  activeTab: 0,
  split: null,
  openInNewTab(id) {
    set((s) => {
      const base = s.tabs.length ? s.tabs : s.currentId ? [s.currentId] : []
      return { tabs: [...base, id], activeTab: base.length, currentId: id, view: 'page' }
    })
  },
  selectTab(i) {
    const id = get().tabs[i]
    if (id) set({ activeTab: i, currentId: id, view: 'page', split: get().split === id ? null : get().split })
  },
  closeTab(i) {
    const s = get()
    if (s.tabs.length <= 1) return
    const tabs = s.tabs.filter((_, k) => k !== i)
    const activeTab = Math.min(i < s.activeTab ? s.activeTab - 1 : s.activeTab, tabs.length - 1)
    set({ tabs, activeTab, currentId: tabs[activeTab] ?? null, view: 'page' })
  },
  // aynı sayfa iki bölmede birden açılmaz (iki otomatik kayıt birbirini ezmesin)
  openSplit: (id) => set((s) => ({ split: id && id !== s.currentId ? id : null })),

  async createPage(parentId) {
    const node = await kernel.pages.create(parentId)
    if (parentId) set((s) => ({ expanded: { ...s.expanded, [parentId]: true } }))
    await get().refreshTree()
    set({ currentId: node.id, view: 'page' })
  },

  async setSettings(patch) {
    // önce arayüzü güncelle (kontrollü bileşenler geri sıçramasın), sonra diske yaz
    set((s) => ({ settings: { ...s.settings, ...patch } }))
    const settings = await kernel.settings.set(patch)
    set({ settings })
  },

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleToc: () => set((s) => ({ tocVisible: !s.tocVisible })),
  toggleFocus: () => set((s) => ({ focusMode: !s.focusMode })),
  setExpanded: (id, open) => set((s) => ({ expanded: { ...s.expanded, [id]: open } })),
  setRenaming: (id) => set({ renamingId: id }),
  setOverlay: (overlay) => set({ overlay }),
  view: 'page',
  openHome: () => set({ view: 'home', overlay: null }),
  currentTag: null,
  graphFocus: null,
  studyDeck: null,
  openStudy: (deck) => set({ view: 'study', studyDeck: deck ?? null, overlay: null }),
  openGraph: (focus) => set({ view: 'graph', graphFocus: focus, overlay: null }),
  openTag: (tag) => set({ view: 'tag', currentTag: tag, overlay: null }),
  pins: [],
  async togglePin(id) {
    const pins = get().pins
    const pinning = !pins.includes(id)
    await get().setPins(pinning ? [...pins, id] : pins.filter((p) => p !== id))
    if (pinning) window.dispatchEvent(new CustomEvent('kernel:tip', { detail: 'first-pin' }))
  },
  async setPins(ids) {
    set({ pins: ids })
    await kernel.pins.set(ids)
  },

  toast(message, kind = 'info') {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  }
}))

export { findNode }

// Etkin sekme açık sayfayı izler; silinen sayfaların sekmeleri kapanır; sekmeler kaydedilir
useStore.subscribe((s, prev) => {
  if (s.currentId !== prev.currentId && s.currentId && s.tabs.length && s.tabs[s.activeTab] !== s.currentId) {
    const tabs = [...s.tabs]
    tabs[s.activeTab] = s.currentId
    useStore.setState({ tabs, split: s.split === s.currentId ? null : s.split })
    return
  }
  if (s.tree !== prev.tree && s.tabs.length) {
    const tabs = s.tabs.filter((id) => findNode(s.tree, id) !== null)
    if (tabs.length !== s.tabs.length) {
      useStore.setState({ tabs: tabs.length > 1 ? tabs : [], activeTab: Math.min(s.activeTab, Math.max(0, tabs.length - 1)) })
      return
    }
  }
  if (s.split && s.tree !== prev.tree && !findNode(s.tree, s.split)) useStore.setState({ split: null })
  if ((s.tabs !== prev.tabs || s.activeTab !== prev.activeTab) && s.vaultPath) {
    try {
      localStorage.setItem(TABS_KEY(s.vaultPath), JSON.stringify({ tabs: s.tabs, activeTab: s.activeTab }))
    } catch {
      // depo kapalıysa sekmeler yalnızca bu oturumda kalır
    }
  }
})

