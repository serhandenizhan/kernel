import { app } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeAtomic } from './vault/atomic'

// Uygulama düzeyi ayar: hangi kasa açık (userData/config.json)
const configFile = () => join(app.getPath('userData'), 'config.json')

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory()

export async function resolveVaultPath(): Promise<string | null> {
  const env = process.env['KERNEL_VAULT']
  if (env) return env
  try {
    const { vaultPath } = JSON.parse(await readFile(configFile(), 'utf8')) as { vaultPath?: string }
    // kayıtlı klasör yoksa (örn. harici disk takılı değil) seçim ekranı gösterilir
    return vaultPath && isDir(vaultPath) ? vaultPath : null
  } catch {
    return null
  }
}

export async function saveVaultPath(vaultPath: string): Promise<void> {
  await writeAtomic(configFile(), JSON.stringify({ vaultPath }, null, 2))
}

export function defaultVaultPath(): string {
  return join(app.getPath('documents'), 'Kernel')
}
