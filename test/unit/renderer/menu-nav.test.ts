import { describe, expect, it } from 'vitest'
import { moveIndex } from '../../../src/renderer/shell/menu-nav'

describe('moveIndex', () => {
  it('aşağı: -1\'den ilk öğeye, sondan başa sarar', () => {
    expect(moveIndex(4, -1, 1)).toBe(0)
    expect(moveIndex(4, 1, 1)).toBe(2)
    expect(moveIndex(4, 3, 1)).toBe(0)
  })
  it('yukarı: -1\'den son öğeye, baştan sona sarar', () => {
    expect(moveIndex(4, -1, -1)).toBe(3)
    expect(moveIndex(4, 2, -1)).toBe(1)
    expect(moveIndex(4, 0, -1)).toBe(3)
  })
  it('boş listede -1', () => {
    expect(moveIndex(0, -1, 1)).toBe(-1)
  })
})
