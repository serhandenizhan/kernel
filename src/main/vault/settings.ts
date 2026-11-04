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
    tips: { ...base.tips, ...(patch.tips ?? {}) }
  }
}

export async function readSettings(root: string): Promise<Settings> {
  try {
    return merge(DEFAULT_SETTINGS, JSON.parse(await readFile(file(root), 'utf8')) as Partial<Settings>)
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

export async function writeSettings(root: string, patch: Partial<Settings>): Promise<Settings> {
  const next = merge(await readSettings(root), patch)
  await mkdir(join(root, '.kernel'), { recursive: true })
  await writeAtomic(file(root), JSON.stringify(next, null, 2))
  return next
}
