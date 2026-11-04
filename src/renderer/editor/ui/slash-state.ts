import { create } from 'zustand'
import type { SlashItem } from '../slash-items'

interface SlashState {
  open: boolean
  items: SlashItem[]
  index: number
  rect: DOMRect | null
  command: ((item: SlashItem) => void) | null
  show(items: SlashItem[], command: (item: SlashItem) => void, rect: DOMRect | null): void
  hide(): void
  key(e: KeyboardEvent): boolean
  choose(i: number): void
}

// "/" menüsünün durumu (Suggestion eklentisi besler, SlashMenu çizer)
export const useSlash = create<SlashState>((set, get) => ({
  open: false,
  items: [],
  index: 0,
  rect: null,
  command: null,
  show: (items, command, rect) => set((s) => ({ open: true, items, command, rect, index: s.open ? Math.min(s.index, Math.max(0, items.length - 1)) : 0 })),
  hide: () => set({ open: false }),
  key: (e) => {
    const s = get()
    if (!s.open || !s.items.length) return false
    if (e.key === 'ArrowDown') {
      set({ index: (s.index + 1) % s.items.length })
      return true
    }
    if (e.key === 'ArrowUp') {
      set({ index: (s.index - 1 + s.items.length) % s.items.length })
      return true
    }
    if (e.key === 'Enter') {
      s.choose(s.index)
      return true
    }
    if (e.key === 'Escape') {
      set({ open: false })
      return true
    }
    return false
  },
  choose: (i) => {
    const s = get()
    const item = s.items[i]
    if (item && s.command) s.command(item)
    set({ open: false })
  }
}))
