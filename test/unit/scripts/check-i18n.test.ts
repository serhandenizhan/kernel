import { describe, it, expect } from 'vitest'
import { findHardcoded } from '../../../scripts/check-i18n.mjs'

describe('findHardcoded', () => {
  it('yorumları atlar, Türkçe metin içeren literal ve JSX metnini bulur', () => {
    const src = "// açıklama yorumu\nconst a = 'Kaydedildi'\nconst b = 'Sayfa açılamadı'\nreturn <p>Değişiklikler kaydedildi</p>\n/* çok satırlı\n yorum */"
    expect(findHardcoded(src).map((f) => f.line)).toEqual([3, 4])
  })
  it('Türkçe harfsiz JSX metnini ve title/placeholder/aria-label değerlerini de bulur', () => {
    const src = '<button title="Kopyala">\n  Kapat\n</button>\n<input placeholder="Ara" aria-label="Ara" />\n<span>{t(\'x\')}</span>\n<kbd>⌘K</kbd>'
    expect(findHardcoded(src).map((f) => f.line)).toEqual([1, 2, 4])
  })
  it('import yollarını, className ve testid değerlerini bulmaz', () => {
    const src = "import { x } from './değer'\n<div className=\"ağaç\" data-testid=\"ağaç\" />"
    expect(findHardcoded(src)).toEqual([])
  })
})
