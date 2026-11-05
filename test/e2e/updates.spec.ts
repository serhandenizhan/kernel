import { test, expect } from '@playwright/test'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

// Sahte "son sürüm" yanıtı: testler GitHub'a hiç çıkmaz
function feed(version: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'kernel-feed-'))
  const file = join(dir, 'latest.json')
  const base = `https://github.com/serhandenizhan/kernel/releases`
  writeFileSync(
    file,
    JSON.stringify({
      tag_name: `v${version}`,
      html_url: `${base}/tag/v${version}`,
      body: 'Yeni özellikler',
      assets: [
        { name: `Kernel-${version}-arm64.dmg`, browser_download_url: `${base}/download/v${version}/Kernel-${version}-arm64.dmg` },
        { name: `Kernel-Setup-${version}.exe`, browser_download_url: `${base}/download/v${version}/Kernel-Setup-${version}.exe` }
      ]
    })
  )
  return file
}

test('yeni sürüm varsa açılışta sorar; İndir dosyayı tarayıcıda açar', async () => {
  const vault = tmpVault()
  const { app, win } = await launch(vault, { KERNEL_TEST_UPDATE_FEED: feed('99.0.0') })
  const prompt = win.getByTestId('update-prompt')
  await expect(prompt).toBeVisible()
  await expect(prompt).toContainText('99.0.0')
  await app.evaluate(({ shell }) => {
    ;(shell as unknown as { openExternal: (u: string) => Promise<void> }).openExternal = async (u: string) => {
      ;(globalThis as unknown as { __opened: string }).__opened = u
    }
  })
  await win.getByTestId('update-download').click()
  await expect(prompt).toBeHidden()
  const opened = await app.evaluate(() => (globalThis as unknown as { __opened?: string }).__opened)
  expect(opened).toMatch(process.platform === 'win32' ? /Kernel-Setup-99\.0\.0\.exe$/ : /Kernel-99\.0\.0-arm64\.dmg$/)
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
