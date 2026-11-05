import { createMenuStore } from './slash-state'

export type WikiItem = { kind: 'page'; id: string; title: string; path: string; target: string; icon?: string } | { kind: 'create'; title: string; target: string }

// "[[" sayfa seçicisinin durumu
export const useWikiMenu = createMenuStore<WikiItem>()
