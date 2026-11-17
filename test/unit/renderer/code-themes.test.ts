import { describe, expect, it } from 'vitest'
import { CODE_THEMES, CLAUDE_DARK, CLAUDE_LIGHT, codeThemeVar } from '../../../src/renderer/lib/code-themes'

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}

describe('kod temaları', () => {
  it('klasik açık/koyu, Claude açık/koyu ve ekstralar var; kimlikler benzersiz', () => {
    const ids = CODE_THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ['auto', 'classic-light', 'classic-dark', 'claude-light', 'claude-dark']) expect(ids).toContain(id)
    expect(ids.length).toBeGreaterThanOrEqual(7)
  })
  it('her tema bir Shiki değişken adına çözülür; otomatik uygulama temasını izler', () => {
    expect(codeThemeVar('auto', 'light')).toBe('github-light')
    expect(codeThemeVar('auto', 'dark')).toBe('github-dark')
    expect(codeThemeVar('claude-dark', 'light')).toBe('claude-dark')
    expect(codeThemeVar('dracula', 'light')).toBe('dracula')
  })
  for (const [name, theme] of [['Claude açık', CLAUDE_LIGHT], ['Claude koyu', CLAUDE_DARK]] as const) {
    it(`${name}: tüm renkler zeminde okunur (WCAG AA 4.5)`, () => {
      const bg = theme.colors['editor.background']!
      expect(contrast(theme.colors['editor.foreground']!, bg), 'varsayılan yazı').toBeGreaterThanOrEqual(4.5)
      for (const rule of theme.tokenColors) {
        const fg = rule.settings.foreground
        if (fg) expect(contrast(fg, bg), `${rule.scope.join(', ')} ${fg}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})
