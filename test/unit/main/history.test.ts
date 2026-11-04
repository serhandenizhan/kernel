import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HistoryStore } from '../../../src/main/history'

const MIN = 60_000
const DAY = 86_400_000
let root: string
let clock: number
const now = () => new Date(clock)

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kernel-hist-'))
  clock = Date.UTC(2026, 10, 4, 10, 0, 0)
})

describe('HistoryStore', () => {
  it('en fazla 5 dakikada bir anlık görüntü alır', async () => {
    const h = new HistoryStore(root, now)
    expect(await h.snapshot('P', 'v1')).toBe(true)
    clock += 2 * MIN
    expect(await h.snapshot('P', 'v2')).toBe(false)
    clock += 4 * MIN
    expect(await h.snapshot('P', 'v3')).toBe(true)
    expect((await h.list('P')).length).toBe(2)
  })
  it('force kuralı atlar', async () => {
    const h = new HistoryStore(root, now)
    await h.snapshot('P', 'v1')
    clock += MIN
    expect(await h.snapshot('P', 'v2', { force: true })).toBe(true)
  })
  it('liste yeniden eskiye, read yazılan metni döner', async () => {
    const h = new HistoryStore(root, now)
    await h.snapshot('P', 'eski')
    clock += 10 * MIN
    await h.snapshot('P', 'yeni')
    const list = await h.list('P')
    expect(list.map((e) => e.time)).toEqual([new Date(clock).toISOString(), new Date(clock - 10 * MIN).toISOString()])
    expect(await h.read('P', list[1]!.versionId)).toBe('eski')
    await expect(h.read('P', '19990101T000000000')).rejects.toThrow()
  })
  it('saklama: 30 gün tamamı, 30 gün–1 yıl günde bir, sonrası silinir', async () => {
    const base = clock
    const h = new HistoryStore(root, now)
    const at = async (ms: number, text: string) => {
      clock = ms
      await h.snapshot('P', text, { force: true })
    }
    await at(base - 400 * DAY, 'çok eski')
    await at(base - 40 * DAY, 'a')
    await at(base - 40 * DAY + 60 * MIN, 'b')
    await at(base - 40 * DAY + 120 * MIN, 'c')
    for (let i = 0; i < 3; i++) await at(base - 10 * DAY + i * 10 * MIN, `yakın${i}`)
    clock = base
    await h.prune('P')
    const texts = await Promise.all((await h.list('P')).map((e) => h.read('P', e.versionId)))
    expect(texts).toEqual(['yakın2', 'yakın1', 'yakın0', 'c'])
  })
  it('sayfa kimliği klasör adı olarak güvenlidir', async () => {
    const h = new HistoryStore(root, now)
    await expect(h.snapshot('../kacis', 'x')).rejects.toThrow()
    expect(readdirSync(root)).toEqual([])
  })
})
