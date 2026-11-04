import { describe, it, expect } from 'vitest'
import { findOverlaps } from '../../../scripts/check-private-leak.mjs'

describe('findOverlaps', () => {
  it('biçim işaretleri farklı olsa da aynı satırı yakalar', () => {
    expect(findOverlaps(['Gizli ders cümlesi burada yazıyor ve uzun'], [{ path: 'a.txt', text: 'x\n- **Gizli ders cümlesi burada yazıyor ve uzun**' }])).toEqual([{ path: 'a.txt', line: 2, kind: 'line' }])
  })
  it('6 kelimelik ortak ifadeyi yakalar', () => {
    expect(findOverlaps(['bir iki üç dört beş altı yedi'], [{ path: 'b.md', text: 'önce bir iki üç dört beş altı sonra' }])).toEqual([{ path: 'b.md', line: 1, kind: 'phrase' }])
  })
  it('ilgisiz metinde sessiz kalır', () => {
    expect(findOverlaps(['tamamen farklı bir metin'], [{ path: 'c.md', text: 'alakasız içerik' }])).toEqual([])
  })
})
