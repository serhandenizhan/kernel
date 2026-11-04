import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('içindekiler paneli başlıkları listeler ve tıklayınca kaydırır', async () => {
  const vault = tmpVault()
  const filler = Array.from({ length: 40 }, (_, i) => `Paragraf ${i}`).join('\n\n')
  writeFileSync(join(vault, 'Uzun.md'), `# Giriş\n\n${filler}\n\n## Orta\n\n${filler}\n\n### Son bölüm\n\nbitiş\n`)
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Uzun' }).click()
  await expect(win.getByTestId('editor')).toBeVisible()
  await win.keyboard.press('Meta+Shift+t')
  const items = win.getByTestId('toc-item')
  await expect(items).toHaveCount(3)
  await expect(items.nth(2)).toHaveText('Son bölüm')
  await items.nth(2).click()
  await expect.poll(() => win.locator('.page-surface').evaluate((el) => el.scrollTop)).toBeGreaterThan(500)
  await app.close()
})

test('ayarlar: tema ve not fontu değişir, yeniden başlatınca korunur', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'A.md'), 'metin\n')
  let { app, win } = await launch(vault)
  await win.keyboard.press('Meta+,')
  await expect(win.getByTestId('settings-dialog')).toBeVisible()
  await win.getByTestId('setting-theme').selectOption('dark')
  await expect(win.locator('html')).toHaveAttribute('data-theme', 'dark')
  await win.getByTestId('setting-font').selectOption('sans')
  await expect(win.locator('html')).toHaveAttribute('data-body-font', 'sans')
  await win.getByTestId('setting-strip-citations').uncheck()
  await win.keyboard.press('Escape')
  await expect(win.getByTestId('settings-dialog')).toHaveCount(0)
  await app.close()
  ;({ app, win } = await launch(vault))
  await expect(win.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(win.locator('html')).toHaveAttribute('data-body-font', 'sans')
  await win.keyboard.press('Meta+,')
  await expect(win.getByTestId('setting-strip-citations')).not.toBeChecked()
  await app.close()
})
