import { create } from 'zustand'

interface MathEditState {
  kind: 'block' | 'inline' | null
  pos: number
  latex: string
  open(kind: 'block' | 'inline', pos: number, latex: string): void
  close(): void
}

// Açık formül düzenleme alanının durumu
export const useMathEdit = create<MathEditState>((set) => ({
  kind: null,
  pos: 0,
  latex: '',
  open: (kind, pos, latex) => set({ kind, pos, latex }),
  close: () => set({ kind: null })
}))
