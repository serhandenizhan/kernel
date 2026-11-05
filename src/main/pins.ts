import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeAtomic } from './vault/atomic'

// Sabitlenen sayfalar: .kernel/pins.json → { "ids": [...] } (sıra kullanıcının sırası)
export class PinStore {
  private readonly file: string

  constructor(root: string) {
    this.file = join(root, '.kernel', 'pins.json')
  }

  /** Sabitlenenler; `keep` verilirse içinde olmayanlar yalnızca bellekte atlanır (dosyaya dokunulmaz: iCloud'un buluta aldığı ya da taşınmakta olan sayfa geri gelince sabitlemesi yerinde olur) */
  async list(keep?: Set<string>): Promise<string[]> {
    let ids: string[] = []
    try {
      const raw = JSON.parse(await readFile(this.file, 'utf8')) as { ids?: unknown }
      if (Array.isArray(raw.ids)) ids = raw.ids.filter((x): x is string => typeof x === 'string')
    } catch {
      return []
    }
    return keep ? ids.filter((id) => keep.has(id)) : ids
  }

  /** Bilinçli silme (sayfa çöpe atıldığında) */
  async remove(id: string): Promise<void> {
    const ids = await this.list()
    if (ids.includes(id)) await this.set(ids.filter((x) => x !== id))
  }

  async set(ids: string[]): Promise<void> {
    await mkdir(join(this.file, '..'), { recursive: true })
    await writeAtomic(this.file, JSON.stringify({ ids: [...new Set(ids)] }, null, 2))
  }
}
