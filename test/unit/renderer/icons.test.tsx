import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Icon, ICON_NAMES } from '../../../src/renderer/assets/icons'

describe('Icon', () => {
  it('her ikon dekoratif SVG olarak çizilir', () => {
    expect(ICON_NAMES.length).toBe(14)
    for (const name of ICON_NAMES) {
      const html = renderToStaticMarkup(<Icon name={name} />)
      expect(html, name).toContain('<svg')
      expect(html, name).toContain('aria-hidden="true"')
      expect(html, name).toContain('stroke="currentColor"')
    }
  })
  it('başlık verilince erişilebilir ad taşır', () => {
    const html = renderToStaticMarkup(<Icon name="home" title="Ana sayfa" size={20} />)
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Ana sayfa"')
    expect(html).toContain('width="20"')
  })
})
