import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAutosave } from '../../../src/renderer/editor/autosave'

describe('createAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('hızlı ardışık değişiklikleri 500 ms sonra tek kayıtta toplar', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const a = createAutosave(save)
    a.schedule()
    a.schedule()
    a.schedule()
    expect(a.state).toBe('dirty')
    await vi.advanceTimersByTimeAsync(499)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(a.state).toBe('saved')
  })

  it('flush bekleyen kaydı hemen yapar', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const a = createAutosave(save)
    a.schedule()
    await a.flush()
    expect(save).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('kayıt hatasında error olur ve 5 sn sonra tekrar dener', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('disk')).mockResolvedValue(undefined)
    const states: string[] = []
    const a = createAutosave(save, 500, (s) => states.push(s))
    a.schedule()
    await vi.advanceTimersByTimeAsync(500)
    expect(a.state).toBe('error')
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).toHaveBeenCalledTimes(2)
    expect(a.state).toBe('saved')
    expect(states).toEqual(['dirty', 'saving', 'error', 'saving', 'saved'])
  })

  it('kayıt sürerken gelen değişiklik kaybolmaz', async () => {
    let resolve!: () => void
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>((r) => (resolve = r))).mockResolvedValue(undefined)
    const a = createAutosave(save)
    a.schedule()
    await vi.advanceTimersByTimeAsync(500)
    a.schedule()
    resolve()
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenCalledTimes(2)
  })

  it('pause bekleyen kaydı durdurur, resume sonrası tekrar kaydeder', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const a = createAutosave(save)
    a.schedule()
    a.pause()
    a.schedule()
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).not.toHaveBeenCalled()
    a.resume()
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush kaydın başarılı olup olmadığını döner', async () => {
    const ok = createAutosave(vi.fn().mockResolvedValue(undefined))
    ok.schedule()
    expect(await ok.flush()).toBe(true)
    const bad = createAutosave(vi.fn().mockRejectedValue(new Error('disk')))
    bad.schedule()
    expect(await bad.flush()).toBe(false)
    bad.dispose()
  })

  it('reset bekleyen kaydı atar ve durumu kaydedildi yapar', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const a = createAutosave(save)
    a.schedule()
    a.pause()
    a.reset()
    a.resume()
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
    expect(a.state).toBe('saved')
  })
})
