// Güncelleme denetimi: GitHub "releases/latest" yanıtını yorumlar (saf; ağ erişimi ana süreçte)

export interface UpdateInfo {
  version: string
  /** indirilecek dosya (yoksa sürüm sayfası) */
  url: string
  /** sürüm sayfası */
  page: string
  notes: string
  /** uygulama içinde indirilip kurulacak dosya (macOS: zip, Windows: kurulum); yoksa null ve elle indirilir */
  install: string | null
}

/** Yalnızca bu deponun adreslerine izin verilir (yanıt bozuk ya da sahte olsa bile başka siteye gidilmez) */
export const RELEASES_PREFIX = 'https://github.com/serhandenizhan/kernel/releases/'

/** Adres bu deponun github.com sürüm sayfalarından biri mi (../ ile kaçış ve kullanıcı adı/parola içeren adres reddedilir) */
export function isReleaseUrl(raw: string): boolean {
  if (!raw.startsWith(RELEASES_PREFIX)) return false
  try {
    const u = new URL(raw)
    return u.origin === 'https://github.com' && !u.username && !u.password && u.pathname.startsWith('/serhandenizhan/kernel/releases/')
  } catch {
    return false
  }
}

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
  if (!/^\d+(\.\d+)*/.test(version) || !isReleaseUrl(page)) return null
  const assets = Array.isArray(r['assets']) ? (r['assets'] as Record<string, unknown>[]) : []
  const want = platform === 'win32' ? /\.exe$/i : platform === 'darwin' ? /arm64\.dmg$/i : null
  const find = (re: RegExp | null) => (re ? assets.find((a) => re.test(str(a?.['name'])) && isReleaseUrl(str(a?.['browser_download_url']))) : undefined)
  const asset = find(want)
  const inst = find(platform === 'win32' ? /\.exe$/i : platform === 'darwin' ? /arm64-mac\.zip$/i : null)
  return {
    version,
    url: asset ? str(asset['browser_download_url']) : page,
    page,
    notes: str(r['body']),
    install: inst ? str(inst['browser_download_url']) : null
  }
}

/** Yeni ve atlanmamış sürüm varsa true */
export function shouldOffer(info: UpdateInfo | null, current: string, skipped: string | null): boolean {
  if (!info) return false
  if (skipped && compareVersions(info.version, skipped) === 0) return false
  return compareVersions(info.version, current) > 0
}

/** macOS: çalışan dosyadan (…/Kernel.app/Contents/MacOS/Kernel) uygulama paketinin yolu */
export function macBundleFromExe(exe: string): string | null {
  const m = /^(.+\.app)\/Contents\/MacOS\/[^/]+$/.exec(exe)
  return m ? m[1]! : null
}

/** Disk görüntüsünden (/Volumes) ya da macOS'un karantina kopyasından (AppTranslocation) çalışırken paket değiştirilemez */
export function canSelfUpdate(bundle: string): boolean {
  return !bundle.startsWith('/Volumes/') && !bundle.includes('/AppTranslocation/')
}

/**
 * macOS paket değiştirme betiği: $1 uygulamanın süreç kimliği, $2 kurulu paket, $3 yeni paket.
 * Uygulama kapanınca eskisini yedeğe alır, yenisini yerine koyar; bir adım başarısız olursa eskisini geri koyar; sonra açar.
 */
export function macSwapScript(): string {
  return [
    '#!/bin/sh',
    'i=0',
    'while kill -0 "$1" 2>/dev/null && [ $i -lt 300 ]; do sleep 0.1; i=$((i+1)); done',
    'rm -rf "$2.old"',
    'if mv "$2" "$2.old"; then',
    '  if mv "$3" "$2"; then rm -rf "$2.old"; else mv "$2.old" "$2"; fi',
    'fi',
    'xattr -dr com.apple.quarantine "$2" 2>/dev/null',
    'open "$2"',
    ''
  ].join('\n')
}
