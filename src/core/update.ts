// Güncelleme denetimi: GitHub "releases/latest" yanıtını yorumlar (saf; ağ erişimi ana süreçte)

export interface UpdateInfo {
  version: string
  /** indirilecek dosya (yoksa sürüm sayfası) */
  url: string
  /** sürüm sayfası */
  page: string
  notes: string
}

/** Yalnızca bu deponun adreslerine izin verilir (yanıt bozuk ya da sahte olsa bile başka siteye gidilmez) */
export const RELEASES_PREFIX = 'https://github.com/serhandenizhan/kernel/releases/'

const parts = (v: string) => {
  const [core, pre] = v.trim().replace(/^v/i, '').split('-', 2) as [string, string | undefined]
  return { nums: core.split('.').map((n) => Number.parseInt(n, 10) || 0), pre }
}

/** a > b ise pozitif, eşitse 0, küçükse negatif; ön sürüm (-beta) aynı sürümden eskidir */
export function compareVersions(a: string, b: string): number {
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < Math.max(x.nums.length, y.nums.length); i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0)
    if (d !== 0) return d
  }
  if (x.pre && !y.pre) return -1
  if (!x.pre && y.pre) return 1
  return (x.pre ?? '').localeCompare(y.pre ?? '')
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Yanıttan bu platformun dosyasını seçer; geçersiz / taslak / ön sürüm ise null */
export function parseRelease(json: unknown, platform: string): UpdateInfo | null {
  if (!json || typeof json !== 'object') return null
  const r = json as Record<string, unknown>
  if (r['draft'] === true || r['prerelease'] === true) return null
  const version = str(r['tag_name']).replace(/^v/i, '')
  const page = str(r['html_url'])
  if (!/^\d+(\.\d+)*/.test(version) || !page.startsWith(RELEASES_PREFIX)) return null
  const assets = Array.isArray(r['assets']) ? (r['assets'] as Record<string, unknown>[]) : []
  const want = platform === 'win32' ? /\.exe$/i : platform === 'darwin' ? /arm64\.dmg$/i : null
  const asset = want ? assets.find((a) => want.test(str(a?.['name'])) && str(a?.['browser_download_url']).startsWith(RELEASES_PREFIX)) : undefined
  return { version, url: asset ? str(asset['browser_download_url']) : page, page, notes: str(r['body']) }
}

/** Yeni ve atlanmamış sürüm varsa true */
export function shouldOffer(info: UpdateInfo | null, current: string, skipped: string | null): boolean {
  if (!info) return false
  if (skipped && compareVersions(info.version, skipped) === 0) return false
  return compareVersions(info.version, current) > 0
}
