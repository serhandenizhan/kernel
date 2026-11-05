import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SrsStore } from '../../../src/main/srs'
import type { Card } from '@core/cards'

const DAY = 86_400_000
let root: string
let now: Date
let store: SrsStore
const card = (id: string, pageId = 'P'): Card => ({ id, pageId, question: `q-${id}`, answer: 'a' })

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kernel-srs-'))
  now = new Date('2026-11-05T10:00:00Z')
  store = new SrsStore(root, () => now)
})

describe('SrsStore', () => {
  it('treats unseen cards as due and schedules them after a review', async () => {
    const cards = [card('a'), card('b')]
    expect((await store.due(cards)).map((c) => c.id)).toEqual(['a', 'b'])
    await store.review('a', 'good')
    expect((await store.due(cards)).map((c) => c.id)).toEqual(['b'])
    now = new Date(now.getTime() + 30 * DAY)
    expect((await store.due(cards)).map((c) => c.id).sort()).toEqual(['a', 'b'])
    const raw = JSON.parse(readFileSync(join(root, '.kernel', 'srs.json'), 'utf8'))
    expect(raw.cards.a.reps).toBe(1)
  })

  it('"again" keeps the card due soon, "easy" pushes it further than "good"', async () => {
    await store.review('x', 'again')
    await store.review('g', 'good')
    await store.review('e', 'easy')
    const s = await store.states()
    expect(new Date(s['x']!.due).getTime()).toBeLessThan(new Date(s['g']!.due).getTime())
    expect(new Date(s['g']!.due).getTime()).toBeLessThan(new Date(s['e']!.due).getTime())
  })

  it('keeps data of vanished cards for 30 days, then prunes it', async () => {
    await store.review('old', 'good')
    await store.sync([card('new')])
    expect((await store.states())['old']?.orphanSince).toBeTruthy()
    now = new Date(now.getTime() + 29 * DAY)
    await store.sync([card('new')])
    expect((await store.states())['old']).toBeTruthy()
    now = new Date(now.getTime() + 2 * DAY)
    await store.sync([card('new')])
    expect((await store.states())['old']).toBeUndefined()
  })

  it('a card that comes back is no longer an orphan', async () => {
    await store.review('c', 'good')
    await store.sync([])
    await store.sync([card('c')])
    expect((await store.states())['c']?.orphanSince).toBeUndefined()
  })

  it('survives a corrupt file: keeps a backup and starts empty; skips broken records', async () => {
    mkdirSync(join(root, '.kernel'))
    writeFileSync(join(root, '.kernel', 'srs.json'), '{bozuk')
    expect(await store.due([card('a')])).toHaveLength(1)
    await store.review('a', 'good')
    expect(readdirSync(join(root, '.kernel')).some((f) => f.startsWith('srs.json.corrupt-'))).toBe(true)

    const other = mkdtempSync(join(tmpdir(), 'kernel-srs-'))
    mkdirSync(join(other, '.kernel'))
    writeFileSync(join(other, '.kernel', 'srs.json'), JSON.stringify({ version: 1, cards: { ok: { due: '2027-01-01T00:00:00Z', stability: 3, difficulty: 5, elapsed_days: 0, scheduled_days: 1, reps: 1, lapses: 0, state: 2 }, bad: { due: 'dün' }, worse: 7 } }))
    const s2 = new SrsStore(other, () => now)
    expect(Object.keys(await s2.states())).toEqual(['ok'])
    expect(existsSync(join(other, '.kernel', 'srs.json'))).toBe(true)
  })

  it('does not treat an unreadable file as empty (progress is not wiped)', async () => {
    const dir = join(root, '.kernel', 'srs.json')
    mkdirSync(dir, { recursive: true }) // okuma EISDIR ile başarısız olur
    await expect(store.due([card('a')])).rejects.toThrow()
    expect(existsSync(dir)).toBe(true)
  })
})

