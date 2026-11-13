import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

const PAGE = '# Başlık\n\n' + Array.from({ length: 30 }, (_, i) => `Paragraf ${i}`).join('\n\n') + '\n\n## Formüller\n\nMetin satırı.\n\n> [!note] Yalnız başlıklı not.\n\n| Ad | Değer |\n| --- | --- |\n| a | 1 |\n\n- [ ] Görev bir\n\nDüz paragraf.\n'

test('not sayfası: başlık altı boşluk, hafif tablo, renk çizgili not kutusu, görev boyutu, kaybolan "Kaydedildi", içe alınmış içindekiler', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Tasarım.md'), PAGE)
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Tasarım' }).click()
  await expect(win.locator('.kernel-editor h2')).toBeVisible()
  // başlıkla altındaki satır arasında nefes payı
  const gap = await win.evaluate(() => {
    const h = document.querySelector('.kernel-editor h2')!
    return h.nextElementSibling!.getBoundingClientRect().top - h.getBoundingClientRect().bottom
  })
  expect(gap).toBeGreaterThanOrEqual(8)
  // tablo: başlık sola dayalı, hücrelerde dikey çizgi yok
  const table = await win.locator('.kernel-editor th').first().evaluate((th) => {
    const td = document.querySelector('.kernel-editor td')!
    return { align: getComputedStyle(th).textAlign, left: getComputedStyle(td).borderLeftWidth }
  })
  expect(table.align).toMatch(/left|start/)
  expect(table.left).toBe('0px')
  // not kutusu: solda renk çizgisi; yalnız başlıklı kutuda boş içerik şeridi görünmez
  const callout = win.locator('.callout').first()
  expect(await callout.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe('none')
  await expect(callout.locator('.callout-content')).toBeHidden()
  // görev satırı paragrafla aynı boyut ve yazı tipinde
  const sizes = await win.evaluate(() => {
    const p = document.querySelector('.kernel-editor > p')!
    const task = document.querySelector('.kernel-editor ul[data-type="taskList"] li p')!
    return [getComputedStyle(p).fontSize, getComputedStyle(task).fontSize, getComputedStyle(p).fontFamily === getComputedStyle(task).fontFamily]
  })
  expect(sizes[1]).toBe(sizes[0])
  expect(sizes[2]).toBe(true)
  // "Kaydedildi" birkaç saniye sonra kaybolur
  await expect.poll(() => win.getByTestId('save-status').evaluate((e) => getComputedStyle(e).opacity), { timeout: 6000 }).toBe('0')
  // içindekiler çizgileri kaydırma çubuğundan uzak
  const rail = await win.evaluate(() => document.querySelector('.page-surface')!.getBoundingClientRect().right - document.querySelector('[data-testid="toc-rail"]')!.getBoundingClientRect().right)
  expect(rail).toBeGreaterThanOrEqual(20)
  await app.close()
})

test('ana sayfa: ısı haritasının yanında özet; kartlar tek stil. Ayarlar: tema düğme grubu ve kapatma düğmesi', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Ders.md'), 'metin\n')
  writeFileSync(join(vault, 'Kart.md'), 'Soru :: Cevap\n')
  const { app, win } = await launch(vault, {}, { home: true })
  const stats = win.getByTestId('home-stats')
  await expect(stats.getByTestId('home-stat')).toHaveCount(3)
  await expect(stats).toContainText('Bu hafta')
  await expect(win.getByTestId('home-review')).toBeVisible()
  expect(await win.getByTestId('home-review').evaluate((e) => getComputedStyle(e).boxShadow)).toBe('none')
  await win.keyboard.press('ControlOrMeta+,')
  await win.getByTestId('setting-theme-dark').click()
  await expect(win.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(win.getByTestId('setting-theme-dark')).toHaveAttribute('aria-checked', 'true')
  await win.getByTestId('setting-width-wide').click()
  await expect(win.locator('html')).toHaveAttribute('data-page-width', 'wide')
  await win.getByTestId('settings-close').click()
  await expect(win.getByTestId('settings-dialog')).toHaveCount(0)
  await app.close()
})
