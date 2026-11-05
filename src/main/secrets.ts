import { rm } from 'node:fs/promises'
import { join } from 'node:path'

// Notion token'ı yalnızca bu oturumda ana süreç belleğinde tutulur: diske, Anahtar Zinciri'ne,
// kasaya, ayarlara ve loglara asla yazılmaz (macOS parola penceresi de hiç açılmaz).
let token: string | null = null

export async function saveToken(value: string): Promise<void> {
  token = value
}

export async function loadToken(): Promise<string | null> {
  return token
}

export async function clearToken(): Promise<void> {
  token = null
}

/** Eski sürümlerin şifreli token dosyasını siler (çözmeden; Anahtar Zinciri'ne erişmez) */
export async function removeLegacyTokenFile(userData: string): Promise<void> {
  await rm(join(userData, 'notion-token.bin'), { force: true })
}
