import { test, expect } from '@playwright/test'
import { chmodSync, existsSync } from 'node:fs'
import { join } from 'node:path'
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

test('5.3: tek bir yeniden adlandırma hatasından sonra başlık alanı kilitli kalmaz', async () => {
  test.skip(process.platform === 'win32', 'POSIX dizin izinleri gerekli')
  const { app, win, vault } = await launch()
  try {
    await win.getByTestId('new-page').click()
    await win.getByTestId('page-title').fill('Ilk')
    await win.getByTestId('page-title').press('Enter')
    await expect.poll(() => existsSync(join(vault, 'Ilk.md'))).toBe(true)

    chmodSync(vault, 0o555)
    try {
      await win.getByTestId('page-title').fill('Hata')
      await win.getByTestId('page-title').press('Enter')
      await expect(win.getByTestId('toast').filter({ hasText: 'yeniden adlandırılamadı' }).first()).toBeVisible({ timeout: 5000 })
    } finally {
      chmodSync(vault, 0o755)
    }

    await win.getByTestId('page-title').fill('Kurtuldu')
    await win.getByTestId('page-title').press('Enter')
    await expect(win.getByTestId('tree-row').filter({ hasText: 'Kurtuldu' })).toBeVisible({ timeout: 5000 })
    await expect.poll(() => existsSync(join(vault, 'Kurtuldu.md'))).toBe(true)
  } finally {
    chmodSync(vault, 0o755)
    await app.close()
  }
})
