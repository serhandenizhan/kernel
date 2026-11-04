import { describe, it, expect } from 'vitest'
import { protectCode } from '@core/smart-paste/protect'

describe('protectCode', () => {
  it('satır içi kodu gizler ve geri koyar', () => {
    const p = protectCode('kod `[0, 1]` ve $x$')
    expect(p.text).not.toContain('[0, 1]')
    expect(p.text).toContain('$x$')
    expect(p.restore(p.text)).toBe('kod `[0, 1]` ve $x$')
  })
  it('çitli blokları (girintili olanlar dahil) gizler', () => {
    const src = 'a\n  ```python\n  x = "$y$"\n  ```\nb\n~~~\n\\(z\\)\n~~~'
    const p = protectCode(src)
    expect(p.text).not.toContain('$y$')
    expect(p.text).not.toContain('\\(z\\)')
    expect(p.text.startsWith('a\n')).toBe(true)
    expect(p.restore(p.text)).toBe(src)
  })
  it('kapanmamış çit sonuna kadar korunur', () => {
    const p = protectCode('```\n$a$')
    expect(p.text).not.toContain('$a$')
    expect(p.restore(p.text)).toBe('```\n$a$')
  })
})
