import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { writeAtomic } from './atomic'

const file = (root: string) => join(root, '.kernel', 'settings.json')

function merge(base: Settings, patch: Partial<Settings>): Settings {
  return {
    ...base,
    ...patch,
    paste: { ...base.paste, ...(patch.paste ?? {}) },
    tips: { ...base.tips, ...(patch.tips ?? {}) },
    backup: { ...base.backup, ...(patch.backup ?? {}) }
  }
}

export const SETTINGS_SCHEMA = 2

export async function readSettings(root: string): Promise<Settings> {
  let raw: Partial<Settings>
  try {
    raw = JSON.parse(await readFile(file(root), 'utf8')) as Partial<Settings>
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
  const settings = merge(DEFAULT_SETTINGS, raw)
  // şema 2 göçü: not fontu bir kerelik SF Pro'ya geçer (kullanıcı serif'i beğenmedi, spec §18.1)
  if (!raw.schema || raw.schema < SETTINGS_SCHEMA) {
    settings.bodyFont = 'sans'
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
