import { create } from 'zustand'
import { DEFAULT_SETTINGS, type Settings, type TreeNode } from '@shared/types'
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
  overlay: 'search' | 'settings' | 'export' | 'guide' | 'history' | 'notion' | null
  /** Sayfanın diskten yeniden okunmasını tetikler (örn. sürüm geri yükleme) */
  reloadToken: number
  reloadPage(): void
  init(): Promise<void>
  refreshTree(): Promise<void>
  openPage(id: string | null): void
  /** ana sayfayı açar (görünüm Task 12'de; şimdilik etkisiz) */
  openHome(): void
  /** sabitlenen sayfa kimlikleri (kullanıcı sırası) */
  pins: string[]
  togglePin(id: string): Promise<void>
  setPins(ids: string[]): Promise<void>
  createPage(parentId: string | null): Promise<void>
  setSettings(patch: Partial<Settings>): Promise<void>
  toggleSidebar(): void
  toggleToc(): void
  setExpanded(id: string, open: boolean): void
  setRenaming(id: string | null): void
  setOverlay(o: State['overlay']): void
  toast(message: string, kind?: Toast['kind']): void
}

let toastSeq = 0

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
    const [settings, tree, pins] = await Promise.all([kernel.settings.get(), kernel.pages.tree(), kernel.pins.list()])
    set({ ready: true, vaultPath: info.path, settings, tree, pins, currentId: tree[0]?.id ?? null })
  },

  async refreshTree() {
    const [tree, pins] = await Promise.all([kernel.pages.tree(), kernel.pins.list()])
    const { currentId } = get()
    set({ tree, pins, currentId: currentId && findNode(tree, currentId) ? currentId : (tree[0]?.id ?? null) })
  },

  openPage(id) {
    set({ currentId: id })
  },

  async createPage(parentId) {
    const node = await kernel.pages.create(parentId)
    if (parentId) set((s) => ({ expanded: { ...s.expanded, [parentId]: true } }))
    await get().refreshTree()
    set({ currentId: node.id })
  },

  async setSettings(patch) {
    // önce arayüzü güncelle (kontrollü bileşenler geri sıçramasın), sonra diske yaz
    set((s) => ({ settings: { ...s.settings, ...patch } }))
    const settings = await kernel.settings.set(patch)
    set({ settings })
  },

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleToc: () => set((s) => ({ tocVisible: !s.tocVisible })),
  setExpanded: (id, open) => set((s) => ({ expanded: { ...s.expanded, [id]: open } })),
  setRenaming: (id) => set({ renamingId: id }),
  setOverlay: (overlay) => set({ overlay }),
  openHome: () => undefined,
  pins: [],
  async togglePin(id) {
    const pins = get().pins
    await get().setPins(pins.includes(id) ? pins.filter((p) => p !== id) : [...pins, id])
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
