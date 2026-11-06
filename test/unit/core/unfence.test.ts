import { describe, it, expect } from 'vitest'
import { shouldUnfence, unfence } from '@core/smart-paste/unfence'

describe('unfence', () => {
  it('strips a single wrapping fence and returns its language', () => {
    expect(unfence('```mermaid\nflowchart LR\n  A --> B\n```')).toEqual({ code: 'flowchart LR\n  A --> B', lang: 'mermaid' })
    expect(unfence('~~~\nx = 1\n~~~\n')).toEqual({ code: 'x = 1', lang: null })
  })
  it('tolerates surrounding blank lines and windows line endings', () => {
    expect(unfence('\n```py\r\nprint(1)\r\n```\n\n')).toEqual({ code: 'print(1)', lang: 'py' })
  })
  it('leaves text alone when it is not one fenced block', () => {
    expect(unfence('a\n```js\nx\n```')).toBeNull()
    expect(unfence('```js\nx\n```\n```js\ny\n```')).toBeNull()
    expect(unfence('düz metin')).toBeNull()
  })
})

describe('shouldUnfence', () => {
  it('keeps fences when the block itself is markdown or plain text', () => {
    expect(shouldUnfence('markdown')).toBe(false)
    expect(shouldUnfence('md')).toBe(false)
    expect(shouldUnfence('mermaid')).toBe(true)
    expect(shouldUnfence(null)).toBe(true)
  })
})
