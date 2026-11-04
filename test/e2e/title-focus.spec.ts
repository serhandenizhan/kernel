import { test, expect } from '@playwright/test'
import { launch } from './helpers/app'

// Başlıkta Enter'dan hemen sonra yazılan ilk harf de gövdeye gitmeli (hızlı yazanlar için)
test('başlıkta Enter sonrası hemen yazılan metin gövdeye gider', async () => {
  const { app, win } = await launch()
  for (let i = 0; i < 6; i++) {
    await win.getByTestId('new-page').click()
    await expect(win.getByTestId('page-title')).toHaveValue('')
    await win.getByTestId('page-title').fill(`Sayfa ${i}`)
    await win.getByTestId('page-title').press('Enter')
    await win.keyboard.type('ilk')
    await expect(win.getByTestId('page-title')).toHaveValue(`Sayfa ${i}`)
    await expect(win.getByTestId('editor')).toHaveText('ilk')
  }
  await app.close()
})
