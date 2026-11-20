import { describe, expect, it } from 'vitest'
import { coverCss } from '../../../src/renderer/assets/covers'

describe('coverCss', () => {
  it('url(...) içindeki tırnak ve ters eğik çizgi karakterlerini kaçışlar', () => {
    expect(coverCss('attachments/a"b\\c.png', (s) => `kernel-file://vault/${s}`)).toBe(
      'url("kernel-file://vault/attachments/a\\"b\\\\c.png") center / cover no-repeat'
    )
  })
})
