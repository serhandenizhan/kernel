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
  sidebarVisible: boolean
  tocVisible: boolean
  expanded: Record<string, boolean>
  renamingId: string | null
  toasts: Toast[]
  overlay: 'search' | 'settings' | 'export' | 'guide' | null
  init(): Promise<void>
  refreshTree(): Promise<void>
  openPage(id: string | null): void
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
  sidebarVisible: true,
  tocVisible: false,
  expanded: {},
  renamingId: null,
  toasts: [],
  overlay: null,

  async init() {
    const info = await kernel.vault.info()
    if (!info) {
      set({ ready: true, vaultPath: null })
      return
    }
    const [settings, tree] = await Promise.all([kernel.settings.get(), kernel.pages.tree()])
    set({ ready: true, vaultPath: info.path, settings, tree, currentId: tree[0]?.id ?? null })
  },

  async refreshTree() {
    const tree = await kernel.pages.tree()
    const { currentId } = get()
    set({ tree, currentId: currentId && findNode(tree, currentId) ? currentId : (tree[0]?.id ?? null) })
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
    const settings = await kernel.settings.set(patch)
    set({ settings })
  },

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleToc: () => set((s) => ({ tocVisible: !s.tocVisible })),
  setExpanded: (id, open) => set((s) => ({ expanded: { ...s.expanded, [id]: open } })),
  setRenaming: (id) => set({ renamingId: id }),
  setOverlay: (overlay) => set({ overlay }),

  toast(message, kind = 'info') {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  }
}))

export { findNode }
