import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('ana sayfa açılışta gelir, kayıtla canlı güncellenir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Gezegenler.md'), '---\nicon: "🪐"\n---\nGüneş sistemi.\n')
  const { app, win } = await launch(vault, {}, { home: true })
  await expect(win.getByTestId('home')).toBeVisible()
  await expect(win.getByTestId('home-course')).toHaveCount(1)
  await expect(win.getByTestId('home-heatmap').locator('[data-count]')).toHaveCount(84)
  await win.getByTestId('home-course').click()
  await win.getByTestId('editor').click()
  await win.keyboard.type(' Mars.')
  await expect.poll(async () => (await import('node:fs')).readFileSync(join(vault, 'Gezegenler.md'), 'utf8'), { timeout: 5000 }).toContain('Mars.')
  await win.getByTestId('nav-home').click()
  await expect(win.getByTestId('home-recent-edited')).toContainText('Gezegenler')
  await expect(win.getByTestId('home-heatmap').locator('[data-count="1"]')).toHaveCount(1)
  // ana sayfa açıkken dışarıdan yeni dosya → yenilemeden görünür
  writeFileSync(join(vault, 'Sıralama.md'), 'Quicksort.\n')
  await expect(win.getByTestId('home-course')).toHaveCount(2, { timeout: 5000 })
  await app.close()
})

test('boş kasada boş durum', async () => {
  const { app, win } = await launch(tmpVault(), {}, { home: true })
  await expect(win.getByTestId('home-empty')).toBeVisible()
  await app.close()
})
