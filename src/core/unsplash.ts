// Unsplash kapak görselleri: arama adresi, yanıtın işlenmesi ve adres doğrulama (saf; ağ erişimi ana süreçte)

export interface UnsplashPhoto {
  id: string
  alt: string
  /** tam boyutlu görselin taban adresi (genişlik / kalite sonradan eklenir) */
  raw: string
  thumb: string
  author: string
  authorUrl: string
  /** Unsplash kullanım kuralı: seçilen fotoğraf için bu adres çağrılır */
  downloadLocation: string
}

export const UNSPLASH_API = 'https://api.unsplash.com'

export function searchUrl(query: string, page: number): string {
  const u = new URL(`${UNSPLASH_API}/search/photos`)
  u.searchParams.set('query', query)
  u.searchParams.set('page', String(Math.max(1, Math.floor(page))))
  u.searchParams.set('per_page', '18')
  u.searchParams.set('orientation', 'landscape')
  u.searchParams.set('content_filter', 'high')
  return u.toString()
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Arama yanıtı → geçerli fotoğraflar (eksik alanlı kayıtlar atılır) */
export function parseSearch(json: unknown): { photos: UnsplashPhoto[]; totalPages: number } {
  const root = json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
  const results = Array.isArray(root['results']) ? (root['results'] as Record<string, unknown>[]) : []
  const photos: UnsplashPhoto[] = []
  for (const r of results) {
    const urls = (r?.['urls'] ?? {}) as Record<string, unknown>
    const user = (r?.['user'] ?? {}) as Record<string, unknown>
    const links = (r?.['links'] ?? {}) as Record<string, unknown>
    const userLinks = (user['links'] ?? {}) as Record<string, unknown>
    const id = str(r?.['id'])
    const raw = str(urls['raw'])
    const thumb = str(urls['thumb'])
    if (!id || !raw || !thumb || !str(user['name'])) continue
    photos.push({ id, alt: str(r?.['alt_description']), raw, thumb, author: str(user['name']), authorUrl: str(userLinks['html']), downloadLocation: str(links['download_location']) })
  }
  const totalPages = typeof root['total_pages'] === 'number' ? (root['total_pages'] as number) : photos.length ? 1 : 0
  return { photos, totalPages }
}

function hostIs(raw: string, host: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && u.hostname === host && !u.username && !u.password
  } catch {
    return false
  }
}

/** İndirilecek görsel yalnızca Unsplash'in görsel sunucusundan olabilir */
export const isUnsplashImageUrl = (raw: string) => hostIs(raw, 'images.unsplash.com')
/** Uygulamanın dışarıda açtığı bağlantılar yalnızca unsplash.com'a gider */
export const isUnsplashLink = (raw: string) => hostIs(raw, 'unsplash.com')

/** Kapak olarak kaydedilecek dosyanın adresi: kapak genişliği için 2000 px, JPEG */
export function photoFileUrl(raw: string): string {
  const u = new URL(raw)
  u.searchParams.set('w', '2000')
  u.searchParams.set('q', '80')
  u.searchParams.set('fm', 'jpg')
  u.searchParams.set('fit', 'max')
  return u.toString()
}

export const creditLine = (author: string) => `${author} · Unsplash`
