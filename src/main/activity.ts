import { mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { PageSummary } from '@shared/types'
import { localDay } from '@core/home'
import { writeAtomic } from './vault/atomic'

const KEEP_DAYS = 400

// Etkinlik kaydı: .kernel/activity.json → { "YYYY-AA-GG": [o gün kaydedilen sayfa kimlikleri] } (spec §18.2)
export class ActivityStore {
  private readonly file: string
  private chain: Promise<unknown> = Promise.resolve()

  constructor(
    root: string,
    private readonly now: () => Date = () => new Date()
  ) {
    this.file = join(root, '.kernel', 'activity.json')
  }

  async read(): Promise<Record<string, string[]>> {
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')) as Record<string, unknown>
      const out: Record<string, string[]> = {}
      for (const [day, ids] of Object.entries(raw)) if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Array.isArray(ids)) out[day] = ids.filter((x): x is string => typeof x === 'string')
      return out
    } catch {
      return {}
    }
  }

  /** Bugünün kaydına sayfayı ekler; 400 günden eski günleri siler. Yazımlar sıraya alınır (eşzamanlı kayıp olmaz). */
  record(pageId: string): Promise<void> {
    const job = this.chain.then(async () => {
      const data = await this.read()
      const today = localDay(this.now())
      const list = data[today] ?? []
      if (!list.includes(pageId)) data[today] = [...list, pageId]
      const cutoff = localDay(new Date(this.now().getTime() - KEEP_DAYS * 86_400_000))
      for (const day of Object.keys(data)) if (day < cutoff) delete data[day]
      await this.write(data)
    })
    this.chain = job.catch(() => undefined)
    return job
  }

  /** Dosya yoksa (ilk kurulum) sayfaların son düzenlenme günlerinden kaba bir başlangıç yazar */
  seedIfMissing(pages: PageSummary[]): Promise<void> {
    const job = this.chain.then(async () => {
      if (existsSync(this.file)) return
      const data: Record<string, string[]> = {}
      for (const p of pages) {
        if (!p.updated) continue
        const d = new Date(p.updated)
        if (Number.isNaN(d.getTime())) continue
        const day = localDay(d)
        ;(data[day] ??= []).push(p.id)
      }
      await this.write(data)
    })
    this.chain = job.catch(() => undefined)
    return job
  }

  private async write(data: Record<string, string[]>): Promise<void> {
    await mkdir(join(this.file, '..'), { recursive: true })
    const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)))
    await writeAtomic(this.file, JSON.stringify(sorted))
  }
}
