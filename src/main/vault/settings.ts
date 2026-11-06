import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { writeAtomic } from './atomic'

const file = (root: string) => join(root, '.kernel', 'settings.json')

// tanınmayan değerler varsayılana döner (elle düzenlenmiş ya da yeni sürümün yazdığı dosya uygulamayı çökertmesin)
const ALLOWED = {
  theme: ['system', 'light', 'dark'],
  bodyFont: ['plex', 'serif', 'sans'],
  pageWidth: ['narrow', 'normal', 'wide'],
  language: ['system', 'tr', 'en', 'de'],
  startView: ['home', 'last']
} as const

function sanitize(s: Settings): Settings {
  for (const [k, values] of Object.entries(ALLOWED) as [keyof typeof ALLOWED, readonly string[]][]) {
    if (!values.includes(s[k] as string)) (s as unknown as Record<string, unknown>)[k] = DEFAULT_SETTINGS[k]
  }
  return s
}

function sanitizeUpdates(u: Settings['updates']): Settings['updates'] {
  return { check: u.check !== false, skipped: typeof u.skipped === 'string' ? u.skipped : null }
}

function merge(base: Settings, patch: Partial<Settings>): Settings {
  return sanitize({
    ...base,
    ...patch,
    paste: { ...base.paste, ...(patch.paste ?? {}) },
    tips: { ...base.tips, ...(patch.tips ?? {}) },
    backup: { ...base.backup, ...(patch.backup ?? {}) },
    updates: sanitizeUpdates({ ...base.updates, ...(patch.updates ?? {}) })
  })
}

export const SETTINGS_SCHEMA = 3

export async function readSettings(root: string): Promise<Settings> {
  let raw: Partial<Settings>
  try {
    raw = JSON.parse(await readFile(file(root), 'utf8')) as Partial<Settings>
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
  const settings = merge(DEFAULT_SETTINGS, raw)
  // şema 3 göçü: not fontu bir kerelik IBM Plex Sans'a geçer (kullanıcı isteği, 2026-11-07; önceki göç SF Pro'ya idi)
  if (!raw.schema || raw.schema < SETTINGS_SCHEMA) {
    settings.bodyFont = 'plex'
    settings.schema = SETTINGS_SCHEMA
    try {
      await writeAtomic(file(root), JSON.stringify(settings, null, 2))
    } catch {
      // yazılamazsa göç bir sonraki açılışta tekrarlanır
    }
  }
  return settings
}

// kasa başına yazım kuyruğu: art arda gelen değişiklikler (oku-birleştir-yaz) birbirini ezmesin
const queues = new Map<string, Promise<unknown>>()

export function writeSettings(root: string, patch: Partial<Settings>): Promise<Settings> {
  const run = async () => {
    const next = merge(await readSettings(root), patch)
    await mkdir(join(root, '.kernel'), { recursive: true })
    await writeAtomic(file(root), JSON.stringify(next, null, 2))
    return next
  }
  const prev = queues.get(root) ?? Promise.resolve()
  const job = prev.then(run, run)
  queues.set(root, job.catch(() => undefined))
  return job
}
