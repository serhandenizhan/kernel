import { describe, expect, it } from 'vitest'
import { canSelfUpdate, compareVersions, isReleaseUrl, macBundleFromExe, macSwapScript, parseRelease, shouldOffer } from '@core/update'

const release = {
  tag_name: 'v0.5.0',
  html_url: 'https://github.com/serhandenizhan/kernel/releases/tag/v0.5.0',
  body: 'Yenilikler',
  draft: false,
  prerelease: false,
  assets: [
    { name: 'Kernel-0.5.0-arm64.dmg', browser_download_url: 'https://github.com/serhandenizhan/kernel/releases/download/v0.5.0/Kernel-0.5.0-arm64.dmg' },
    { name: 'Kernel-Setup-0.5.0.exe', browser_download_url: 'https://github.com/serhandenizhan/kernel/releases/download/v0.5.0/Kernel-Setup-0.5.0.exe' },
    { name: 'Kernel-Setup-0.5.0.exe.blockmap', browser_download_url: 'https://github.com/serhandenizhan/kernel/releases/download/v0.5.0/Kernel-Setup-0.5.0.exe.blockmap' }
  ]
}

describe('compareVersions', () => {
  it('compares numerically, ignoring a leading v', () => {
    expect(compareVersions('v0.10.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareVersions('0.4.0', 'v0.4.0')).toBe(0)
    expect(compareVersions('0.4.0', '0.4.1')).toBeLessThan(0)
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
  })

  it('treats a pre-release as older than the same release', () => {
    expect(compareVersions('0.5.0-beta.1', '0.5.0')).toBeLessThan(0)
  })
})

describe('parseRelease', () => {
  it('picks the dmg on macOS and the installer on Windows', () => {
    expect(parseRelease(release, 'darwin')).toEqual({
      version: '0.5.0',
      url: release.assets[0]!.browser_download_url,
      page: release.html_url,
      notes: 'Yenilikler',
      install: null
    })
    expect(parseRelease(release, 'win32')?.url).toBe(release.assets[1]!.browser_download_url)
  })

  it('falls back to the release page when there is no matching asset', () => {
    expect(parseRelease({ ...release, assets: [] }, 'darwin')?.url).toBe(release.html_url)
  })

  it('rejects drafts, pre-releases, malformed data and foreign urls', () => {
    expect(parseRelease({ ...release, draft: true }, 'darwin')).toBeNull()
    expect(parseRelease({ ...release, prerelease: true }, 'darwin')).toBeNull()
    expect(parseRelease({ message: 'Not Found' }, 'darwin')).toBeNull()
    expect(parseRelease(null, 'darwin')).toBeNull()
    expect(parseRelease({ ...release, html_url: 'https://evil.example/x', assets: [] }, 'darwin')).toBeNull()
    const evil = { ...release, assets: [{ name: 'Kernel-0.5.0-arm64.dmg', browser_download_url: 'https://evil.example/k.dmg' }] }
    expect(parseRelease(evil, 'darwin')?.url).toBe(release.html_url)
  })
})

describe('shouldOffer', () => {
  const info = { version: '0.5.0', url: 'u', page: 'p', notes: '', install: null }
  it('offers only newer, not skipped versions', () => {
    expect(shouldOffer(info, '0.4.0', null)).toBe(true)
    expect(shouldOffer(info, '0.5.0', null)).toBe(false)
    expect(shouldOffer(info, '0.6.0', null)).toBe(false)
    expect(shouldOffer(info, '0.4.0', '0.5.0')).toBe(false)
    expect(shouldOffer(null, '0.4.0', null)).toBe(false)
  })
})

describe('isReleaseUrl', () => {
  it('accepts only this repository releases on github.com', () => {
    expect(isReleaseUrl('https://github.com/serhandenizhan/kernel/releases/download/v1/K.dmg')).toBe(true)
    expect(isReleaseUrl('https://github.com/serhandenizhan/kernel/releases/../../other/repo')).toBe(false)
    expect(isReleaseUrl('https://user:pw@github.com/serhandenizhan/kernel/releases/x')).toBe(false)
    expect(isReleaseUrl('https://github.com.evil.io/serhandenizhan/kernel/releases/x')).toBe(false)
    expect(isReleaseUrl('not a url')).toBe(false)
  })
})

const D = 'https://github.com/serhandenizhan/kernel/releases/download/v0.7.0/'
const withZip = {
  ...release,
  tag_name: 'v0.7.0',
  html_url: 'https://github.com/serhandenizhan/kernel/releases/tag/v0.7.0',
  assets: [
    { name: 'Kernel-0.7.0-arm64.dmg', browser_download_url: D + 'Kernel-0.7.0-arm64.dmg' },
    { name: 'Kernel-0.7.0-arm64-mac.zip', browser_download_url: D + 'Kernel-0.7.0-arm64-mac.zip' },
    { name: 'Kernel-Setup-0.7.0.exe', browser_download_url: D + 'Kernel-Setup-0.7.0.exe' }
  ]
}

describe('uygulama içi güncelleme', () => {
  it("macOS'ta kurulum için zip, Windows'ta kurulum dosyası seçilir", () => {
    expect(parseRelease(withZip, 'darwin')?.install).toBe(D + 'Kernel-0.7.0-arm64-mac.zip')
    expect(parseRelease(withZip, 'darwin')?.url).toBe(D + 'Kernel-0.7.0-arm64.dmg')
    expect(parseRelease(withZip, 'win32')?.install).toBe(D + 'Kernel-Setup-0.7.0.exe')
    expect(parseRelease(withZip, 'linux')?.install).toBeNull()
  })
  it('başka siteye işaret eden zip kurulum için kullanılmaz', () => {
    const bad = { ...withZip, assets: [{ name: 'Kernel-0.7.0-arm64-mac.zip', browser_download_url: 'https://evil.example/Kernel.zip' }] }
    expect(parseRelease(bad, 'darwin')?.install).toBeNull()
  })
  it('çalışan dosyadan uygulama paketinin yolu bulunur', () => {
    expect(macBundleFromExe('/Applications/Kernel.app/Contents/MacOS/Kernel')).toBe('/Applications/Kernel.app')
    expect(macBundleFromExe('/usr/local/bin/electron')).toBeNull()
  })
  it('disk görüntüsünden ya da karantina kopyasından çalışırken kendini güncellemez', () => {
    expect(canSelfUpdate('/Applications/Kernel.app')).toBe(true)
    expect(canSelfUpdate('/Users/a/Applications/Kernel.app')).toBe(true)
    expect(canSelfUpdate('/Volumes/Kernel/Kernel.app')).toBe(false)
    expect(canSelfUpdate('/private/var/folders/x/AppTranslocation/ABC/d/Kernel.app')).toBe(false)
  })
  it('değiştirme betiği uygulama kapanmayı bekler, eskisini yedekler, hata olursa geri koyar ve yeniden açar', () => {
    const s = macSwapScript()
    expect(s).toMatch(/kill -0 "\$1"/)
    expect(s).toContain('mv "$2" "$2.old"')
    expect(s).toContain('mv "$3" "$2"')
    expect(s).toContain('mv "$2.old" "$2"')
    expect(s).toContain('open "$2"')
  })
})
