import { net } from 'electron'
import { readFile } from 'node:fs/promises'
import { creditLine, isUnsplashImageUrl, isUnsplashLink, parseSearch, photoFileUrl, searchUrl, UNSPLASH_API, type UnsplashPhoto } from '@core/unsplash'
import { devEnv } from './env'

// Unsplash kapak görselleri. Ağa yalnızca ana süreç çıkar (arayüzün CSP'si dış sunucuya izin vermez):
// arama sonuçları ve küçük önizlemeler buradan gelir, seçilen görsel kasaya kaydedilir.
// Testler asla ağa çıkmaz: KERNEL_TEST_UNSPLASH_FIXTURE (arama yanıtı dosyası), KERNEL_TEST_UNSPLASH_IMAGE (indirilecek görsel).

export type SearchError = 'no-key' | 'invalid-key' | 'rate-limit' | 'network'
export interface ThumbView {
  id: string
  alt: string
  author: string
  /** data: adresi (arayüz dış sunucuya bağlanmaz) */
  thumb: string
}
export type SearchResult = { ok: true; photos: ThumbView[]; totalPages: number } | { ok: false; error: SearchError }
export interface PickedPhoto {
  /** kasaya kaydedilen görselin kasa içi yolu */
  src: string
  credit: string
  creditUrl: string
}

// Seçim yalnızca son aramada ana sürecin kendi bulduğu fotoğraflardan olabilir: arayüz rastgele adres veremez
const known = new Map<string, UnsplashPhoto>()
const headers = (key: string) => ({ Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' })

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url
  if (!isUnsplashImageUrl(url)) return ''
  try {
    const res = await net.fetch(url)
    if (!res.ok) return ''
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`
  } catch {
    return ''
  }
}

export async function searchPhotos(key: string, query: string, page: number): Promise<SearchResult> {
  if (!key.trim()) return { ok: false, error: 'no-key' }
  if (!query.trim()) return { ok: true, photos: [], totalPages: 0 }
  let json: unknown
  const fixture = devEnv('KERNEL_TEST_UNSPLASH_FIXTURE')
  if (fixture) {
    try {
      json = JSON.parse(await readFile(fixture, 'utf8'))
    } catch {
      return { ok: false, error: 'network' }
    }
  } else if (devEnv('KERNEL_TEST')) {
    return { ok: false, error: 'network' }
  } else {
    try {
      const res = await net.fetch(searchUrl(query.trim(), page), { headers: headers(key) })
      if (res.status === 401) return { ok: false, error: 'invalid-key' }
      // Unsplash, saatlik istek sınırı dolunca 403 döner
      if (res.status === 403 || res.status === 429) return { ok: false, error: 'rate-limit' }
      if (!res.ok) return { ok: false, error: 'network' }
      json = await res.json()
    } catch {
      return { ok: false, error: 'network' }
    }
  }
  const { photos, totalPages } = parseSearch(json)
  if (page <= 1) known.clear()
  for (const p of photos) known.set(p.id, p)
  const views = await Promise.all(photos.map(async (p) => ({ id: p.id, alt: p.alt, author: p.author, thumb: await toDataUrl(p.thumb) })))
  return { ok: true, photos: views, totalPages }
}

/** Seçilen fotoğrafı indirir; kasaya kaydetmesi için baytları ve kaynak bilgisini verir */
export async function fetchPhoto(key: string, id: string): Promise<{ bytes: Uint8Array; author: string; credit: string; creditUrl: string }> {
  const photo = known.get(id)
  if (!photo) throw new Error('unknown photo')
  let bytes: Uint8Array
  const local = devEnv('KERNEL_TEST_UNSPLASH_IMAGE')
  if (local) {
    bytes = await readFile(local)
  } else {
    if (!isUnsplashImageUrl(photo.raw)) throw new Error('bad image url')
    const res = await net.fetch(photoFileUrl(photo.raw))
    if (!res.ok) throw new Error(`download ${res.status}`)
    bytes = new Uint8Array(await res.arrayBuffer())
    // Unsplash kullanım kuralı: seçilen fotoğrafın indirme adresi çağrılır (sonuç beklenmez)
    if (photo.downloadLocation.startsWith(`${UNSPLASH_API}/`)) void net.fetch(photo.downloadLocation, { headers: headers(key) }).catch(() => undefined)
  }
  const profile = isUnsplashLink(photo.authorUrl) ? `${photo.authorUrl}${photo.authorUrl.includes('?') ? '&' : '?'}utm_source=kernel&utm_medium=referral` : ''
  return { bytes, author: photo.author, credit: creditLine(photo.author), creditUrl: profile }
}
