import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { writeAtomic } from './vault/atomic'
import { readJsonFile, type JsonFileOpts } from './vault/json-file'

// Uygulama düzeyi ayar dosyası (userData/config.json; kasanın dışında): hangi kasa açık, Unsplash anahtarı.
// Alanlar birbirini ezmesin diye her yazım okuyup birleştirir ve yazımlar sıraya alınır.
export interface AppConfig {
  vaultPath?: string
  /** Unsplash geliştirici "Access Key"i (kasaya ve depoya girmez) */
  unsplashKey?: string
}

export async function readConfigAt(file: string, opts?: JsonFileOpts): Promise<AppConfig> {
  const { value: raw } = await readJsonFile<unknown>(file, () => ({}), opts)
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as AppConfig) : {}
}

const queues = new Map<string, Promise<unknown>>()

/** Verilen alanları günceller; boş dizgi alanı siler */
export function updateConfigAt(file: string, patch: Partial<Record<keyof AppConfig, string>>, opts?: JsonFileOpts): Promise<void> {
  const run = async () => {
    const next: Record<string, unknown> = { ...(await readConfigAt(file, opts)) }
    for (const [k, v] of Object.entries(patch)) {
      if (v) next[k] = v
      else delete next[k]
    }
    await mkdir(dirname(file), { recursive: true })
    // Unsplash anahtarı içerdiğinden yalnızca sahibinin okuyabileceği izinle yazılır
    await writeAtomic(file, JSON.stringify(next, null, 2), undefined, 0o600)
  }
  const prev = queues.get(file) ?? Promise.resolve()
  const p = prev.then(run, run)
  queues.set(file, p.catch(() => undefined))
  return p
}
