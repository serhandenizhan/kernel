import { app } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readConfigAt, updateConfigAt } from './config-file'
import { devEnv } from './env'

// Uygulama düzeyi ayar: hangi kasa açık (userData/config.json)
const configFile = () => join(app.getPath('userData'), 'config.json')

const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory()

export async function resolveVaultPath(): Promise<string | null> {
  const env = devEnv('KERNEL_VAULT')
  if (env) return env
  const { vaultPath } = await readConfigAt(configFile())
  // kayıtlı klasör yoksa (örn. harici disk takılı değil) seçim ekranı gösterilir
  return vaultPath && isDir(vaultPath) ? vaultPath : null
}

export async function saveVaultPath(vaultPath: string): Promise<void> {
  await updateConfigAt(configFile(), { vaultPath })
}

export async function readUnsplashKey(): Promise<string> {
  return (await readConfigAt(configFile())).unsplashKey ?? ''
}

export async function saveUnsplashKey(key: string): Promise<void> {
  await updateConfigAt(configFile(), { unsplashKey: key.trim() })
}

export function defaultVaultPath(): string {
  return join(app.getPath('documents'), 'Kernel')
}
