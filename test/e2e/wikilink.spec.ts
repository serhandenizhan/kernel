import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('[[wiki link]] tıklanınca hedef sayfa açılır, bulunamayan hedef uyarır', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Fizik.md'), 'fizik sayfası\n')
  writeFileSync(join(vault, 'Ana.md'), 'bkz. [[fizik]] ve [[Olmayan Sayfa|şurası]]\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Ana' }).click()
  await expect(win.locator('.wiki-link')).toHaveCount(2)
  await expect(win.locator('.wiki-link').nth(1)).toHaveText('şurası')
  await win.locator('.wiki-link').first().click()
  await expect(win.getByTestId('page-title')).toHaveValue('Fizik')
  await win.getByTestId('tree-row').filter({ hasText: 'Ana' }).click()
  await win.locator('.wiki-link').nth(1).click()
  await expect(win.getByTestId('toast').filter({ hasText: 'Sayfa bulunamadı' })).toBeVisible()
  // düzenleme sonrası wiki link ve başlıklı toggle korunur
  writeFileSync(join(vault, 'Toggle.md'), '<details data-heading="2">\n<summary>Açılır</summary>\n\niç\n\n</details>\n\nson\n')
  await win.reload()
  await win.getByTestId('tree-row').filter({ hasText: 'Toggle' }).click()
  await win.getByText('son', { exact: true }).click()
  await win.keyboard.press('End')
  await win.keyboard.type('!')
  await expect.poll(() => readFileSync(join(vault, 'Toggle.md'), 'utf8'), { timeout: 5000 }).toContain('son!')
  expect(readFileSync(join(vault, 'Toggle.md'), 'utf8')).toContain('data-heading="2"')
  await app.close()
})
