import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('ilk açılışta tur görünür, Atla sonrası yeniden başlatmada da görünmez', async () => {
  const vault = tmpVault()
  let { app, win } = await launch(vault, {}, { onboarding: true })
  await expect(win.getByTestId('tour')).toBeVisible()
  await expect(win.getByTestId('tour')).toContainText('Notların senin')
  await win.getByTestId('tour-next').click()
  await expect(win.getByTestId('tour')).toContainText('Akıllı yapıştırma')
  await win.getByTestId('tour-skip').click()
  await expect(win.getByTestId('tour')).toHaveCount(0)
  await app.close()
  ;({ app, win } = await launch(vault, {}, { onboarding: true }))
  await expect(win.getByTestId('sidebar')).toBeVisible()
  await expect(win.getByTestId('tour')).toHaveCount(0)
  await app.close()
})

test('Cmd+/ rehberi açar, kısayol tablosu aranır, canlı yapıştırma örneği render edilir', async () => {
  const { app, win } = await launch()
  await win.keyboard.press('Meta+/')
  await expect(win.getByTestId('guide')).toBeVisible()
  await expect(win.getByTestId('guide-paste-demo').locator('.katex').first()).toBeVisible()
  await win.getByTestId('shortcut-search').fill('pdf')
  const rows = win.getByTestId('shortcut-row')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('⌘E')
  await win.keyboard.press('Escape')
  await expect(win.getByTestId('guide')).toHaveCount(0)
  await app.close()
})

test('ilk yapıştırmada ipucu bir kez görünür', async () => {
  const vault = tmpVault()
  const { app, win } = await launch(vault, {}, { onboarding: true, skipTour: true })
  await win.getByTestId('new-page').click()
  await expect(win.getByTestId('page-title')).toHaveValue('')
  await win.getByTestId('page-title').fill('İpucu')
  await win.getByTestId('page-title').press('Enter')
  await expect.poll(() => existsSync(join(vault, 'İpucu.md'))).toBe(true)
  const pasteText = async (text: string) =>
    win.evaluate((text) => {
      const dt = new DataTransfer()
      dt.setData('text/plain', text)
      document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    }, text)
  await pasteText('ilk $x$')
  await expect(win.getByTestId('tip')).toContainText('Akıllı yapıştırma')
  await win.getByTestId('tip-close').click()
  await pasteText(' ikinci $y$')
  await win.waitForTimeout(500)
  await expect(win.getByTestId('tip')).toHaveCount(0)
  await app.close()
})

test('rehberde Faz 2 bölümleri var; canlı Mermaid demosu çizilir; Notion butonu sihirbazı açar', async () => {
  const { app, win } = await launch()
  await win.keyboard.press('Meta+/')
  const guide = win.getByTestId('guide')
  for (const title of ["Notion'dan aktarma", 'Sürüm geçmişi ve yedek', 'Şablonlar', 'Diyagram ve PDF']) await expect(guide.getByRole('heading', { name: title })).toBeVisible()
  await expect(win.getByTestId('guide-mermaid-demo').locator('svg')).toBeVisible({ timeout: 15_000 })
  await win.getByTestId('guide-notion').click()
  await expect(win.getByTestId('notion-wizard')).toBeVisible()
  await app.close()
})

test('Rehber Faz 3 bölümleri: ana sayfa, sabitleme, dil ve görünüm (üç dilde)', async () => {
  const { app, win } = await launch()
  await win.keyboard.press('Meta+/')
  const guide = win.getByTestId('guide')
  for (const title of ['Ana sayfa', 'Sabitleme', 'Dil ve görünüm']) await expect(guide.getByRole('heading', { name: title })).toBeVisible()
  await expect(guide.getByTestId('guide-home-demo').locator('.heat-cell')).toHaveCount(21)
  await win.keyboard.press('Escape')
  await win.keyboard.press('Meta+,')
  await win.getByTestId('setting-language-en').click()
  await win.keyboard.press('Escape')
  await win.keyboard.press('Meta+/')
  for (const title of ['Home', 'Pinning', 'Language and appearance']) await expect(win.getByTestId('guide').getByRole('heading', { name: title })).toBeVisible()
  await app.close()
})
