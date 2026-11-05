import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeAtomic } from './vault/atomic'

// Sabitlenen sayfalar: .kernel/pins.json → { "ids": [...] } (sıra kullanıcının sırası)
export class PinStore {
  private readonly file: string

  constructor(root: string) {
    this.file = join(root, '.kernel', 'pins.json')
  }

  /** Sabitlenenler; `keep` verilirse içinde olmayanlar (silinen sayfalar) listeden ve dosyadan atılır */
  async list(keep?: Set<string>): Promise<string[]> {
    let ids: string[] = []
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')) as { ids?: unknown }
      if (Array.isArray(raw.ids)) ids = raw.ids.filter((x): x is string => typeof x === 'string')
    } catch {
      return []
    }
    if (keep) {
      const kept = ids.filter((id) => keep.has(id))
      if (kept.length !== ids.length) await this.set(kept)
      return kept
    }
    return ids
  }

  async set(ids: string[]): Promise<void> {
    await mkdir(join(this.file, '..'), { recursive: true })
    await writeAtomic(this.file, JSON.stringify({ ids: [...new Set(ids)] }, null, 2))
  }
}
