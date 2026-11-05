import { describe, it, expect } from 'vitest'
import { SHORTCUTS } from '../../../src/renderer/guide/shortcuts'

// spec §13 kısayol tablosunun Faz 1 satırları
const PHASE1 = ['⌘N', '⌘⇧N', '⌘K', '⌘/', '⌘\\', '⌘⇧T', '⌘E', '⌘⇧V', '⌘B', '⌘I', '⌘U', '⌘⇧S', '⌘⇧M', '⌘⌥C', '⌘,']

describe('SHORTCUTS', () => {
  const phase1 = SHORTCUTS.filter((s) => s.phase === 1)
  it('Faz 1 kısayolları benzersiz', () => {
    expect(new Set(phase1.map((s) => s.keys)).size).toBe(phase1.length)
  })
  it("spec'teki tüm Faz 1 kısayolları var", () => {
    for (const k of PHASE1) expect(phase1.map((s) => s.keys)).toContain(k)
  })
  it('sonraki fazların kısayolları işaretli', () => {
    expect(SHORTCUTS.find((s) => s.keys === '⌘T')?.phase).toBe(3)
  })
})
