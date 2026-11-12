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
  return (await checkLatestRelease(opts)).info
}

/** Elle denetim için: ok=false ise GitHub'a ulaşılamadı (arayüz "güncel" demesin) */
export async function checkLatestRelease(opts: FetchOptions = {}): Promise<{ ok: boolean; info: UpdateInfo | null }> {
  const env = opts.env ?? process.env
  const platform = opts.platform ?? process.platform
  try {
    const feed = env['KERNEL_TEST_UPDATE_FEED']
    if (feed) return { ok: true, info: parseRelease(JSON.parse(await readFile(feed, 'utf8')), platform) }
    // testler asla ağa çıkmaz
    if (env['KERNEL_TEST']) return { ok: false, info: null }
    const doFetch = opts.fetchImpl ?? ((url: string, init: RequestInit) => fetch(url, init))
    const res = await doFetch(LATEST_URL, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Kernel-App' },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    if (!res.ok) return { ok: false, info: null }
    return { ok: true, info: parseRelease(await res.json(), platform) }
  } catch {
    return { ok: false, info: null }
  }
}
