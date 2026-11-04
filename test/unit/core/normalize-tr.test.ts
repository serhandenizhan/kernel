import { describe, it, expect } from 'vitest'
import { normalizeTr } from '@core/normalize-tr'

describe('normalizeTr', () => {
  it('Türkçe büyük harfleri ve özel karakterleri sadeleştirir', () => {
    expect(normalizeTr('IŞIK Ağacı')).toBe('isik agaci')
    expect(normalizeTr('İstanbul ÇÖĞÜŞ')).toBe('istanbul cogus')
  })
  it('NFD girdiyi de aynı sonuca indirger', () => {
    expect(normalizeTr('Özdeğerler')).toBe('ozdegerler')
  })
})
