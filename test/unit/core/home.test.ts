import { describe, it, expect } from 'vitest'
import { computeHome } from '@core/home'
import type { PageSummary } from '@shared/types'

describe('computeHome', () => {
  it('dersler, son düzenlenen/eklenenler, ata dersi ve 84 günlük etkinlik', () => {
    const pages: PageSummary[] = [
      { id: 'g', title: 'Gezegenler', path: 'Gezegenler.md', parentId: null, childCount: 2, updated: '2026-11-01T10:00:00Z', created: '2026-10-01T10:00:00Z' },
      { id: 'm', title: 'Mars', path: 'Gezegenler/Mars.md', parentId: 'g', childCount: 0, updated: '2026-11-05T09:00:00Z', created: '2026-11-04T09:00:00Z' },
      { id: 'v', title: 'Venüs', path: 'Gezegenler/Venüs.md', parentId: 'g', childCount: 0, updated: '2026-11-03T09:00:00Z', created: '2026-11-05T08:00:00Z' },
      { id: 's', title: 'Sıralama', path: 'Sıralama.md', parentId: null, childCount: 0 }
    ]
    const h = computeHome(pages, ['v', 'yok'], { '2026-11-05': ['m', 'v'], '2026-08-01': ['m'] }, '2026-11-05')
    expect(h.courses.map((c) => [c.id, c.descendantCount, c.lastUpdated])).toEqual([
      ['g', 2, '2026-11-05T09:00:00Z'],
      ['s', 0, undefined]
    ])
    expect(h.recentEdited.map((i) => i.id)).toEqual(['m', 'v', 'g'])
    expect(h.recentAdded[0]).toMatchObject({ id: 'v', parentTitle: 'Gezegenler' })
    expect(h.recentEdited.find((i) => i.id === 'g')?.parentTitle).toBeUndefined()
    expect(h.pins.map((p) => p.id)).toEqual(['v'])
    expect(h.activity).toHaveLength(84)
    expect(h.activity.at(-1)).toEqual({ day: '2026-11-05', count: 2 })
    expect(h.activity[0]!.day).toBe('2026-08-14')
    expect(h.totalPages).toBe(4)
  })
  it('en fazla 8 son düzenlenen ve eklenen; derinlemesine ata dersi', () => {
    const pages: PageSummary[] = [{ id: 'r', title: 'Ders', path: 'Ders.md', parentId: null, childCount: 1 }]
    let parent = 'r'
    for (let i = 0; i < 12; i++) {
      pages.push({ id: `p${i}`, title: `S${i}`, path: `x/${i}.md`, parentId: parent, childCount: 1, updated: `2026-11-0${(i % 9) + 1}T00:00:00Z`, created: `2026-10-${10 + i}T00:00:00Z` })
      parent = `p${i}`
    }
    const h = computeHome(pages, [], {}, '2026-11-05')
    expect(h.recentEdited).toHaveLength(8)
    expect(h.recentAdded).toHaveLength(8)
    expect(h.recentAdded.every((i) => i.parentTitle === 'Ders')).toBe(true)
    expect(h.courses[0]!.descendantCount).toBe(12)
  })
})

import { activityStats } from '@core/home'
describe('activityStats', () => {
  const days = (counts: number[]) => counts.map((count, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, count }))
  it('son 7 günün toplamı, aktif gün sayısı ve bugüne (ya da düne) kadar süren seri', () => {
    // son gün bugün: son dört gün aktif → seri 4; son 7 gün 0+2+0+1+3+1+2
    expect(activityStats(days([1, 0, 0, 2, 0, 1, 3, 1, 2]))).toEqual({ week: 9, activeDays: 6, streak: 4 })
  })
  it('bugün henüz bir şey yoksa seri dünden sayılır; iki gün boşsa seri 0', () => {
    expect(activityStats(days([1, 1, 0]))).toEqual({ week: 2, activeDays: 2, streak: 2 })
    expect(activityStats(days([1, 0, 0]))).toEqual({ week: 1, activeDays: 1, streak: 0 })
  })
  it('boş etkinlik', () => {
    expect(activityStats([])).toEqual({ week: 0, activeDays: 0, streak: 0 })
  })
})
