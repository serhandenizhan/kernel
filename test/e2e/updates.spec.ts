import { test, expect } from '@playwright/test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

// Sahte "son sürüm" yanıtı: testler GitHub'a hiç çıkmaz
function feed(version: string, opts: { zip?: boolean; exe?: boolean; body?: string; assets?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'kernel-feed-'))
  const file = join(dir, 'latest.json')
  const base = `https://github.com/serhandenizhan/kernel/releases`
  writeFileSync(
    file,
    JSON.stringify({
      tag_name: `v${version}`,
      html_url: `${base}/tag/v${version}`,
      body: opts.body ?? 'Yeni özellikler',
      assets: opts.assets === false ? [] : [
        { name: `Kernel-${version}-arm64.dmg`, browser_download_url: `${base}/download/v${version}/Kernel-${version}-arm64.dmg` },
        ...(opts.zip !== false ? [{ name: `Kernel-${version}-arm64-mac.zip`, browser_download_url: `${base}/download/v${version}/Kernel-${version}-arm64-mac.zip` }] : []),
        ...(opts.exe !== false ? [{ name: `Kernel-Setup-${version}.exe`, browser_download_url: `${base}/download/v${version}/Kernel-Setup-${version}.exe` }] : [])
      ]
    })
  )
  return file
}

test('derleme dosyaları henüz yüklenmemiş sürüm sunulmaz (CI sürerken İndir sayfaya düşmesin)', async () => {
  const vault = tmpVault()
  const { app, win } = await launch(vault, { KERNEL_TEST_UPDATE_FEED: feed('99.0.0', { assets: false }) })
  await win.waitForTimeout(3500)
  await expect(win.getByTestId('update-prompt')).toHaveCount(0)
  await app.close()
})

test('"Bu sürümü atla" o sürümü bir daha sormaz', async () => {
  const vault = tmpVault()
  const env = { KERNEL_TEST_UPDATE_FEED: feed('99.0.0') }
  let { app, win } = await launch(vault, env)
  await win.getByTestId('update-skip').click()
  await expect(win.getByTestId('update-prompt')).toBeHidden()
  await expect.poll(() => JSON.parse(readFileSync(join(vault, '.kernel', 'settings.json'), 'utf8')).updates?.skipped).toBe('99.0.0')
  await app.close()
  ;({ app, win } = await launch(vault, env))
  await expect(win.locator('.app')).toBeAttached()
  await win.waitForTimeout(800)
  await expect(win.getByTestId('update-prompt')).toHaveCount(0)
  await app.close()
})

test('ayarlardan denetim kapatılınca sormaz; eski sürüm sorulmaz', async () => {
  const vault = tmpVault()
  let { app, win } = await launch(vault, { KERNEL_TEST_UPDATE_FEED: feed('99.0.0') })
  await win.getByTestId('update-later').click()
  await win.keyboard.press('ControlOrMeta+,')
  await win.getByTestId('setting-update-check').uncheck()
  await app.close()
  ;({ app, win } = await launch(vault, { KERNEL_TEST_UPDATE_FEED: feed('99.0.0') }))
  await win.waitForTimeout(800)
  await expect(win.getByTestId('update-prompt')).toHaveCount(0)
  await app.close()
  ;({ app, win } = await launch(tmpVault(), { KERNEL_TEST_UPDATE_FEED: feed('0.0.1') }))
  await win.waitForTimeout(800)
  await expect(win.getByTestId('update-prompt')).toHaveCount(0)
  await app.close()
})

// Sahte yeni sürüm dosyası: macOS'ta Info.plist'i olan bir Kernel.app zip'i, Windows'ta "MZ" ile başlayan bir exe
function fakeAsset(version: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'kernel-asset-'))
  if (process.platform === 'win32') {
    const exe = join(dir, 'setup.exe')
    writeFileSync(exe, Buffer.concat([Buffer.from('MZ'), Buffer.alloc(4096)]))
    return exe
  }
  const contents = join(dir, 'Kernel.app', 'Contents')
  mkdirSync(contents, { recursive: true })
  const plist = join(contents, 'Info.plist')
  execFileSync('/usr/bin/plutil', ['-create', 'xml1', plist])
  execFileSync('/usr/bin/plutil', ['-insert', 'CFBundleIdentifier', '-string', 'app.kernel.notes', plist])
  execFileSync('/usr/bin/plutil', ['-insert', 'CFBundleShortVersionString', '-string', version, plist])
  const zip = join(dir, 'update.zip')
  execFileSync('/usr/bin/ditto', ['-c', '-k', '--keepParent', join(dir, 'Kernel.app'), zip])
  return zip
}

test('Güncelle: yeni sürüm uygulama içinde indirilir, doğrulanır ve yeniden başlatma planlanır; notlar sade görünür', async () => {
  const vault = tmpVault()
  const plan = join(mkdtempSync(join(tmpdir(), 'kernel-plan-')), 'plan.json')
  const body = "## What's Changed\n* feat: kartlar görünür by @someone in https://github.com/serhandenizhan/kernel/pull/9\n\n**Full Changelog**: https://github.com/serhandenizhan/kernel/compare/v1...v2"
  const { app, win } = await launch(vault, {
    KERNEL_TEST_UPDATE_FEED: feed('99.0.0', { zip: true, body }),
    KERNEL_TEST_UPDATE_ASSET: fakeAsset('99.0.0'),
    KERNEL_TEST_UPDATE_DRYRUN: plan
  })
  const prompt = win.getByTestId('update-prompt')
  await expect(prompt).toBeVisible()
  await expect(prompt.getByTestId('update-notes')).toContainText('Kartlar görünür')
  await expect(prompt.getByTestId('update-notes')).not.toContainText('github.com')
  await expect(prompt.getByTestId('update-notes')).not.toContainText('Full Changelog')
  await prompt.getByTestId('update-install').click()
  await expect(prompt.getByTestId('update-progress')).toContainText('Yeniden başlatılıyor')
  await expect.poll(() => existsSync(plan)).toBe(true)
  const p = JSON.parse(readFileSync(plan, 'utf8')) as { cmd: string; args: string[] }
  if (process.platform === 'win32') {
    expect(p.args).toEqual(['/S', '--updated', '--force-run'])
    expect(p.cmd).toMatch(/Kernel-Setup-99\.0\.0\.exe$/)
  } else {
    expect(p.cmd).toBe('/bin/sh')
    expect(p.args[0]).toMatch(/swap\.sh$/)
    expect(p.args[2]).toMatch(/\.app$/)
    expect(p.args[3]).toMatch(/Kernel\.app$/)
  }
  await app.close()
})

test('Güncelle: indirilen paket başka bir sürümse kurulmaz, indirme sayfası açılır', async () => {
  test.skip(process.platform === 'win32', 'sürüm denetimi macOS paketinde')
  const vault = tmpVault()
  const plan = join(mkdtempSync(join(tmpdir(), 'kernel-plan-')), 'plan.json')
  const { app, win } = await launch(vault, {
    KERNEL_TEST_UPDATE_FEED: feed('99.0.0', { zip: true }),
    KERNEL_TEST_UPDATE_ASSET: fakeAsset('98.0.0'),
    KERNEL_TEST_UPDATE_DRYRUN: plan
  })
  await app.evaluate(({ shell }) => {
    ;(shell as unknown as { openExternal: (u: string) => Promise<void> }).openExternal = async (u: string) => {
      ;(globalThis as unknown as { __opened: string }).__opened = u
    }
  })
  await win.getByTestId('update-install').click()
  await expect(win.getByTestId('update-prompt')).toBeHidden()
  expect(existsSync(plan)).toBe(false)
  expect(await app.evaluate(() => (globalThis as unknown as { __opened?: string }).__opened)).toMatch(/Kernel-99\.0\.0-arm64\.dmg$/)
  await app.close()
})

test('ayarlardan elle denetim: açılış denetimi kapalı ya da sürüm atlanmış olsa da yeni sürümü gösterir; güncelse bunu söyler', async () => {
  const vault = tmpVault()
  mkdirSync(join(vault, '.kernel'), { recursive: true })
  writeFileSync(join(vault, '.kernel', 'settings.json'), JSON.stringify({ schema: 3, language: 'tr', tourDone: true, tips: { enabled: false, seen: [] }, updates: { check: false, skipped: '99.0.0' } }))
  let { app, win } = await launch(vault, { KERNEL_TEST_UPDATE_FEED: feed('99.0.0') })
  await win.waitForTimeout(2000)
  await expect(win.getByTestId('update-prompt')).toHaveCount(0)
  await win.keyboard.press('ControlOrMeta+,')
  await expect(win.getByTestId('settings-dialog')).toBeVisible()
  await win.getByTestId('setting-update-now').click()
  await expect(win.getByTestId('update-prompt')).toBeVisible()
  await expect(win.getByTestId('update-prompt')).toContainText('99.0.0')
  await app.close()
  ;({ app, win } = await launch(tmpVault(), { KERNEL_TEST_UPDATE_FEED: feed('0.0.1') }))
  // arayüz hazır olmadan basılan kısayol kaybolur (yavaş makinelerde)
  await expect(win.getByTestId('sidebar')).toBeVisible()
  await win.keyboard.press('ControlOrMeta+,')
  await expect(win.getByTestId('settings-dialog')).toBeVisible()
  await win.getByTestId('setting-update-now').click()
  await expect(win.getByTestId('setting-update-status')).toContainText('güncel')
  await expect(win.getByTestId('update-prompt')).toHaveCount(0)
  await app.close()
})
