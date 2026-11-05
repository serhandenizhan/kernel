import { describe, expect, it } from 'vitest'
import { isModKey, keyLabel } from '@core/keys'

describe('keyLabel', () => {
  it('keeps macOS symbols on a Mac', () => {
    expect(keyLabel('⌘⇧F', true)).toBe('⌘⇧F')
  })
  it('spells shortcuts out for Windows', () => {
    expect(keyLabel('⌘⇧F', false)).toBe('Ctrl+Shift+F')
    expect(keyLabel('⌘⌥C', false)).toBe('Ctrl+Alt+C')
    expect(keyLabel('⌘↵', false)).toBe('Ctrl+Enter')
    expect(keyLabel('⌘\\', false)).toBe('Ctrl+\\')
  })
  it('rewrites shortcuts inside sentences', () => {
    expect(keyLabel("Bitirmek için ⌘↵ (satır içinde ↵), ya da ⌘K'ye bas.", false)).toBe("Bitirmek için Ctrl+Enter (satır içinde Enter), ya da Ctrl+K'ye bas.")
    expect(keyLabel('⌘ tuşuna basılı tutarak tıkla', false)).toBe('Ctrl tuşuna basılı tutarak tıkla')
  })
})

describe('isModKey', () => {
  const ev = (o: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }>) => ({ metaKey: false, ctrlKey: false, altKey: false, ...o })
  it('uses ⌘ on a Mac and Ctrl elsewhere', () => {
    expect(isModKey(ev({ metaKey: true }), true)).toBe(true)
    expect(isModKey(ev({ ctrlKey: true }), true)).toBe(false)
    expect(isModKey(ev({ ctrlKey: true }), false)).toBe(true)
    expect(isModKey(ev({ metaKey: true }), false)).toBe(false)
  })
  it('ignores AltGr (Ctrl+Alt) on Windows so characters like \\ | @ can be typed', () => {
    expect(isModKey(ev({ ctrlKey: true, altKey: true }), false)).toBe(false)
  })
})
