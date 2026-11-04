import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { writeAtomic } from './vault/atomic'

import type { HistoryEntry } from '@shared/types'

export type { HistoryEntry }

const DAY = 86_400_000
const VERSION_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})$/
const SAFE_ID = /^[A-Za-z0-9_-]+$/

const toVersionId = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace('.', '').replace('Z', '')
function fromVersionId(v: string): Date | null {
  const m = VERSION_RE.exec(v)
  return m ? new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!, +m[7]!)) : null
}

// Sayfa sürüm geçmişi: .kernel/history/<sayfaId>/<versionId>.md (dosyanın tam metni)
export class HistoryStore {
  private readonly dir: string
  private lastAt = new Map<string, number>()

  constructor(
    root: string,
    private readonly now: () => Date = () => new Date(),
    private readonly intervalMs = 5 * 60_000
  ) {
    this.dir = join(root, '.kernel', 'history')
  }

  private pageDir(id: string): string {
    if (!SAFE_ID.test(id)) throw new Error('Geçersiz sayfa kimliği')
    return join(this.dir, id)
  }

  /** Son anlık görüntüden bu yana intervalMs geçtiyse (ya da force) yazar; yazıldıysa true */
  async snapshot(id: string, fileText: string, opts: { force?: boolean } = {}): Promise<boolean> {
    const dir = this.pageDir(id)
    const t = this.now().getTime()
    if (!opts.force) {
      let last = this.lastAt.get(id)
      if (last === undefined) {
        const latest = (await this.list(id))[0]
        if (latest) last = new Date(latest.time).getTime()
      }
      if (last !== undefined && t - last < this.intervalMs) return false
    }
    await mkdir(dir, { recursive: true })
    await writeAtomic(join(dir, `${toVersionId(new Date(t))}.md`), fileText)
    this.lastAt.set(id, t)
    await this.prune(id)
    return true
  }

  /** Yeniden eskiye */
  async list(id: string): Promise<HistoryEntry[]> {
    let names: string[]
    try {
      names = await readdir(this.pageDir(id))
    } catch {
      return []
    }
    const out: HistoryEntry[] = []
    for (const n of names) {
      const v = n.replace(/\.md$/, '')
      const d = fromVersionId(v)
      if (!d) continue
      out.push({ versionId: v, time: d.toISOString(), size: (await readFile(join(this.pageDir(id), n))).length })
    }
    return out.sort((a, b) => (a.versionId < b.versionId ? 1 : -1))
  }

  async read(id: string, versionId: string): Promise<string> {
    if (!VERSION_RE.test(versionId)) throw new Error('Geçersiz sürüm')
    return readFile(join(this.pageDir(id), `${versionId}.md`), 'utf8')
  }

  /** Saklama: son 30 gün tamamı; 30 gün–1 yıl arası her günün (UTC) en yenisi; 1 yıldan eskiler silinir */
  async prune(id?: string): Promise<void> {
    const ids = id ? [id] : await readdir(this.dir).catch(() => [] as string[])
    const t = this.now().getTime()
    for (const pid of ids) {
      if (!SAFE_ID.test(pid)) continue
      const keepDay = new Set<string>()
      for (const e of await this.list(pid)) {
        const age = t - new Date(e.time).getTime()
        const day = e.time.slice(0, 10)
        let drop = false
        if (age > 365 * DAY) drop = true
        else if (age > 30 * DAY) {
          if (keepDay.has(day)) drop = true
          else keepDay.add(day)
        }
        if (drop) await rm(join(this.pageDir(pid), `${e.versionId}.md`), { force: true })
      }
    }
  }
}
