import { describe, expect, it } from 'vitest'
import { perfBudget } from './perf'

describe('perfBudget', () => {
  it('yerelde sınır değişmez, CI makinesinde 4 kat pay verilir', () => {
    expect(perfBudget(300, {})).toBe(300)
    expect(perfBudget(300, { CI: 'true' })).toBe(1200)
  })
})
