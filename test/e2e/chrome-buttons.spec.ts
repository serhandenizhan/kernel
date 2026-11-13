import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('kenar çubuğu düğmeyle gizlenir ve geri açılır; sayfa başlığı düğmeleri çizgi ikonlu; "Kaydedildi" kenara yapışmaz', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Not.md'), 'metin\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Not' }).click()
  // kenar çubuğu düğmesi
  await win.getByTestId('sidebar-hide').click()
  await expect(win.getByTestId('sidebar')).toHaveCount(0)
  await win.getByTestId('sidebar-show').click()
  await expect(win.getByTestId('sidebar')).toBeVisible()
  await expect(win.getByTestId('sidebar-show')).toHaveCount(0)
  // ikon ve kapak düğmeleri metin simgesi yerine ikon kullanır
  await win.locator('.page-header').hover()
  await expect(win.getByTestId('add-icon').locator('svg.icon')).toHaveCount(1)
  await expect(win.getByTestId('add-cover').locator('svg.icon')).toHaveCount(1)
  await expect(win.getByTestId('add-icon')).not.toContainText('☺')
  await expect(win.getByTestId('add-cover')).not.toContainText('▭')
  // "Kaydedildi" sayfa yüzeyinin sağ kenarından en az 16 px içeride
  const gap = await win.evaluate(() => {
    const s = document.querySelector('[data-testid="save-status"]')!.getBoundingClientRect()
    const p = document.querySelector('.page-surface')!.getBoundingClientRect()
    return p.right - s.right
  })
  expect(gap).toBeGreaterThanOrEqual(16)
  await app.close()
})
