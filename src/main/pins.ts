import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { writeAtomic } from './vault/atomic'
import { readJsonFile, type JsonFileOpts } from './vault/json-file'

// Sabitlenen sayfalar: .kernel/pins.json → { "ids": [...] } (sıra kullanıcının sırası)
export class PinStore {
  private readonly file: string

  constructor(
    root: string,
    private readonly opts?: JsonFileOpts
  ) {
    this.file = join(root, '.kernel', 'pins.json')
  }

  /** Sabitlenenler; `keep` verilirse içinde olmayanlar yalnızca bellekte atlanır (dosyaya dokunulmaz: iCloud'un buluta aldığı ya da taşınmakta olan sayfa geri gelince sabitlemesi yerinde olur) */
  async list(keep?: Set<string>): Promise<string[]> {
    const { value: raw } = await readJsonFile<unknown>(this.file, () => ({ ids: [] }), this.opts)
    const obj = raw && typeof raw === 'object' ? (raw as { ids?: unknown }) : {}
    const ids = Array.isArray(obj.ids) ? obj.ids.filter((x): x is string => typeof x === 'string') : []
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
