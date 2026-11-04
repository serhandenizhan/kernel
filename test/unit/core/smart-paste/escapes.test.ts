import { describe, it, expect } from 'vitest'
import { normalizeEscapes } from '@core/smart-paste/escapes'

describe('normalizeEscapes', () => {
  it('çift kaçışlı ayraçları teke indirir', () => {
    expect(normalizeEscapes('a \\\\(x\\\\) b \\\\[y\\\\]')).toBe('a \\(x\\) b \\[y\\]')
  })
  it('ayraç olmayan çift ters eğik çizgiye dokunmaz', () => {
    expect(normalizeEscapes('\\\\vec ve a\\\\b')).toBe('\\\\vec ve a\\\\b')
  })
})
