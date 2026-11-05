import { describe, it, expect } from 'vitest'
import { track, waitPending, pendingCount } from '../../../src/main/pending'

describe('pending work tracker', () => {
  it('waits for tracked work to settle before resolving', async () => {
    let done = false
    void track(new Promise((r) => setTimeout(() => ((done = true), r(1)), 40)))
    expect(pendingCount()).toBe(1)
    await waitPending(1000)
    expect(done).toBe(true)
    expect(pendingCount()).toBe(0)
  })

  it('also waits for work started while waiting, and survives rejections', async () => {
    void track(Promise.reject(new Error('x'))).catch(() => undefined)
    void track(new Promise((r) => setTimeout(() => void track(new Promise((r2) => setTimeout(r2, 30))).then(r), 20)))
    await waitPending(1000)
    expect(pendingCount()).toBe(0)
  })

  it('gives up after the timeout', async () => {
    void track(new Promise(() => undefined))
    const t = Date.now()
    await waitPending(60)
    expect(Date.now() - t).toBeLessThan(500)
  })
})
