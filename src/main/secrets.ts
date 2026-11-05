import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { writeAtomic } from './vault/atomic'
import { mainT } from './i18n'

// Notion token'ı: macOS Keychain anahtarıyla (Electron safeStorage) şifrelenmiş olarak userData'da tutulur.
// Kasaya, ayarlara, loglara asla yazılmaz.
export interface SecretStore {
  file: string
  encrypt(s: string): Buffer
  decrypt(b: Buffer): string
}

async function defaultStore(): Promise<SecretStore> {
  const { app, safeStorage } = await import('electron')
  if (!safeStorage.isEncryptionAvailable()) throw new Error(mainT('err.keychain'))
  return { file: join(app.getPath('userData'), 'notion-token.bin'), encrypt: (s) => safeStorage.encryptString(s), decrypt: (b) => safeStorage.decryptString(b) }
}

export async function saveToken(token: string, store?: SecretStore): Promise<void> {
  const s = store ?? (await defaultStore())
  await writeAtomic(s.file, s.encrypt(token))
}

export async function loadToken(store?: SecretStore): Promise<string | null> {
  const s = store ?? (await defaultStore())
  if (!existsSync(s.file)) return null
  try {
    return s.decrypt(await readFile(s.file))
  } catch {
    return null
  }
}

export async function clearToken(store?: SecretStore): Promise<void> {
  const s = store ?? (await defaultStore())
  await rm(s.file, { force: true })
}
