// Ana sayfa hesapları (saf; Electron/DOM yok)
import type { HomeData, HomeItem, PageSummary } from '../shared/types'

const pad = (n: number) => String(n).padStart(2, '0')

/** Yerel tarih (saat dilimine göre), YYYY-AA-GG */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}


const RECENT = 8
const DAYS = 84

/** Ana sayfa verisi: dersler (üst seviye, ağaç sırası), son düzenlenen/eklenenler, sabitlenenler, 84 günlük etkinlik */
export function computeHome(pages: PageSummary[], pins: string[], activity: Record<string, string[]>, today: string): HomeData {
  const byId = new Map(pages.map((p) => [p.id, p]))
  const rootOf = (p: PageSummary): PageSummary => {
    let cur = p
    const seen = new Set<string>()
    while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id)
      cur = byId.get(cur.parentId)!
    }
    return cur
  }
  const item = (p: PageSummary, at?: string): HomeItem => {
    const root = rootOf(p)
    const out: HomeItem = { id: p.id, title: p.title }
    if (p.icon) out.icon = p.icon
    if (root.id !== p.id) out.parentTitle = root.title
    if (at) out.at = at
    return out
  }
  const newest = (a?: string, b?: string) => (!a ? b : !b ? a : a > b ? a : b)

  // dersler: alt sayfa sayısı ve alt ağacın en yeni düzenlemesi
  const desc = new Map<string, { count: number; last?: string }>()
  for (const p of pages) desc.set(p.id, { count: 0, last: p.updated })
  for (const p of pages) {
    const root = rootOf(p)
    if (root.id === p.id) continue
    const d = desc.get(root.id)!
    d.count++
    d.last = newest(d.last, p.updated)
  }
  const courses = pages
    .filter((p) => !p.parentId || !byId.has(p.parentId))
    .map((p) => {
      const d = desc.get(p.id)!
      return { id: p.id, title: p.title, ...(p.icon ? { icon: p.icon } : {}), ...(p.cover ? { cover: p.cover } : {}), childCount: p.childCount, descendantCount: d.count, lastUpdated: d.last }
    })

  const recent = (key: 'updated' | 'created') =>
    pages
      .filter((p) => p[key])
      .sort((a, b) => (a[key]! < b[key]! ? 1 : a[key]! > b[key]! ? -1 : 0))
      .slice(0, RECENT)
      .map((p) => item(p, p[key]))

  // etkinlik: bugünle biten 84 gün (gün dizgileri UTC üzerinden ilerletilir; yaz saati kaymaz)
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const end = Date.UTC(y, m - 1, d)
  const days: { day: string; count: number }[] = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const t = new Date(end - i * 86_400_000)
    const day = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`
    days.push({ day, count: activity[day]?.length ?? 0 })
  }

  return {
    courses,
    pins: pins.map((id) => byId.get(id)).filter((p): p is PageSummary => !!p).map((p) => item(p)),
    recentEdited: recent('updated'),
    recentAdded: recent('created'),
    activity: days,
    totalPages: pages.length
  }
}

/** Isı haritasının yanındaki özet: son 7 gün toplamı, aktif gün sayısı, bugüne (bugün boşsa düne) kadar süren seri */
export function activityStats(days: { day: string; count: number }[]): { week: number; activeDays: number; streak: number } {
  const week = days.slice(-7).reduce((a, d) => a + d.count, 0)
  const activeDays = days.filter((d) => d.count > 0).length
  let i = days.length - 1
  // bugün henüz bir şey yazılmadıysa seri bozulmuş sayılmaz
  if (i >= 0 && days[i]!.count === 0) i--
  let streak = 0
  while (i >= 0 && days[i]!.count > 0) {
    streak++
    i--
  }
  return { week, activeDays, streak }
}
