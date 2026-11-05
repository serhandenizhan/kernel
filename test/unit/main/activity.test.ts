import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ActivityStore } from '../../../src/main/activity'
import { localDay } from '../../../src/core/home'
import type { PageSummary } from '../../../src/shared/types'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kernel-act-'))
})
const at = (d: Date) => () => d

describe('localDay', () => {
  it('yerel tarihe göre YYYY-AA-GG', () => {
    expect(localDay(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05')
    expect(localDay(new Date(2026, 0, 2, 0, 5))).toBe('2026-01-02')
  })
})

describe('ActivityStore', () => {
  it('yerel güne yazar (23:30 düzenlemesi o güne), aynı sayfa bir kez sayılır', async () => {
    const s = new ActivityStore(root, at(new Date(2026, 10, 5, 23, 30)))
    await s.record('a')
    await s.record('a')
    await s.record('b')
    expect(await s.read()).toEqual({ '2026-11-05': ['a', 'b'] })
  })
  it('400 günden eskiyi siler', async () => {
    mkdirSync(join(root, '.kernel'))
    writeFileSync(join(root, '.kernel', 'activity.json'), JSON.stringify({ '2025-09-01': ['x'], '2026-10-01': ['y'] }))
    const s = new ActivityStore(root, at(new Date(2026, 10, 5, 12, 0)))
    await s.record('a')
    expect(await s.read()).toEqual({ '2026-10-01': ['y'], '2026-11-05': ['a'] })
  })
  it('eşzamanlı kayıtlar kaybolmaz', async () => {
    const s = new ActivityStore(root, at(new Date(2026, 10, 5, 12, 0)))
    await Promise.all(['a', 'b', 'c', 'd'].map((id) => s.record(id)))
    expect((await s.read())['2026-11-05']).toHaveLength(4)
  })
  it('dosya yoksa updated tarihlerinden doldurur, varsa dokunmaz', async () => {
    const pages: PageSummary[] = [
      { id: 'a', title: 'A', path: 'A.md', parentId: null, childCount: 0, updated: new Date(2026, 10, 3, 10).toISOString() },
      { id: 'b', title: 'B', path: 'B.md', parentId: null, childCount: 0, updated: new Date(2026, 10, 3, 18).toISOString() },
      { id: 'c', title: 'C', path: 'C.md', parentId: null, childCount: 0 }
    ]
    const s = new ActivityStore(root, at(new Date(2026, 10, 5, 12, 0)))
    await s.seedIfMissing(pages)
    expect(await s.read()).toEqual({ '2026-11-03': ['a', 'b'] })
    expect(existsSync(join(root, '.kernel', 'activity.json'))).toBe(true)
    await s.seedIfMissing([{ ...pages[2]!, updated: new Date(2026, 10, 4).toISOString() }])
    expect(await s.read()).toEqual({ '2026-11-03': ['a', 'b'] })
  })
})
