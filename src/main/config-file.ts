import { readFile } from 'node:fs/promises'
import { writeAtomic } from './vault/atomic'

// Uygulama düzeyi ayar dosyası (userData/config.json; kasanın dışında): hangi kasa açık, Unsplash anahtarı.
// Alanlar birbirini ezmesin diye her yazım okuyup birleştirir ve yazımlar sıraya alınır.
export interface AppConfig {
  vaultPath?: string
  /** Unsplash geliştirici "Access Key"i (kasaya ve depoya girmez) */
  unsplashKey?: string
}

export async function readConfigAt(file: string): Promise<AppConfig> {
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as unknown
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as AppConfig) : {}
  } catch {
    return {}
  }
}

const queues = new Map<string, Promise<unknown>>()

/** Verilen alanları günceller; boş dizgi alanı siler */
export function updateConfigAt(file: string, patch: Partial<Record<keyof AppConfig, string>>): Promise<void> {
  const run = async () => {
    const next: Record<string, unknown> = { ...(await readConfigAt(file)) }
    for (const [k, v] of Object.entries(patch)) {
      if (v) next[k] = v
      else delete next[k]
    }
    await writeAtomic(file, JSON.stringify(next, null, 2))
  }
  const prev = queues.get(file) ?? Promise.resolve()
  const p = prev.then(run, run)
  queues.set(file, p.catch(() => undefined))
  return p
}
