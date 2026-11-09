import { describe, expect, it } from 'vitest'

import { isHeadlessTest } from '../../../src/main/window-options'
describe('isHeadlessTest', () => {
  it('testlerde pencere arka planda açılır (odak çalmaz)', () => {
    expect(isHeadlessTest({ KERNEL_TEST: '1' })).toBe(true)
  })
  it('KERNEL_TEST_SHOW ya da ekran görüntüsü alınırken pencere görünür', () => {
    expect(isHeadlessTest({ KERNEL_TEST: '1', KERNEL_TEST_SHOW: '1' })).toBe(false)
    expect(isHeadlessTest({ KERNEL_TEST: '1', KERNEL_SCREENSHOTS: '1' })).toBe(false)
  })
  it('normal kullanımda pencere görünür', () => {
    expect(isHeadlessTest({})).toBe(false)
  })
})
