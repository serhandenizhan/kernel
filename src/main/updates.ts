import { readFile } from 'node:fs/promises'
import { parseRelease, type UpdateInfo } from '@core/update'

// Güncelleme denetimi: yalnızca GitHub'ın herkese açık sürüm bilgisi okunur; hiçbir kullanıcı verisi gönderilmez
export const LATEST_URL = 'https://api.github.com/repos/serhandenizhan/kernel/releases/latest'
const TIMEOUT_MS = 8000

export interface FetchOptions {
  fetchImpl?: (url: string, init: RequestInit) => Promise<Response>
  platform?: string
  env?: Record<string, string | undefined>
}

/** Son sürüm bilgisi; ağ yoksa, yanıt bozuksa ya da testteysek (besleme dosyası verilmediyse) null */
export async function fetchLatestRelease(opts: FetchOptions = {}): Promise<UpdateInfo | null> {
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  try {
    const feed = env['KERNEL_TEST_UPDATE_FEED']
    if (feed) return parseRelease(JSON.parse(await readFile(feed, 'utf8')), platform)
    // testler asla ağa çıkmaz
    if (env['KERNEL_TEST']) return null
    const doFetch = opts.fetchImpl ?? ((url: string, init: RequestInit) => fetch(url, init))
    const res = await doFetch(LATEST_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Kernel-App' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!res.ok) return null
    return parseRelease(await res.json(), platform)
  } catch {
    return null
  }
}
