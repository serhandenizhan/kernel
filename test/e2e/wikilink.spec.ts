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

test('sayfa linkleri hedef ikonuyla, metin renginde; tek başına link sayfa satırı olur; çözülmeyen soluk', async () => {
  const vault = tmpVault()
  const { mkdirSync } = await import('node:fs')
  writeFileSync(join(vault, 'Gezegenler.md'), '[[Mars]]\n\nBakınız [[Mars]] ve [[Yok]], ayrıca [[Gezegenler/Mars|yol ile]].\n')
  mkdirSync(join(vault, 'Gezegenler'))
  writeFileSync(join(vault, 'Gezegenler', 'Mars.md'), '---\nicon: "🔴"\n---\nKızıl.\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Gezegenler' }).first().click()
  const paras = win.locator('.kernel-editor > p')
  await expect(paras.first()).toHaveClass(/page-row/)
  await expect(paras.nth(1)).not.toHaveClass(/page-row/)
  const links = win.locator('.kernel-editor .wiki-link')
  await expect(links).toHaveCount(4)
  await expect(links.nth(0).locator('.wiki-icon')).toHaveText('🔴')
  await expect(links.nth(1).locator('.wiki-icon')).toHaveText('🔴')
  await expect(links.nth(2)).toHaveClass(/missing/)
  await expect(links.nth(3).locator('.wiki-icon')).toHaveText('🔴')
  // metin rengi: vurgu rengi değil
  const color = await links.nth(1).evaluate((e) => getComputedStyle(e).color)
  const text = await win.locator('.kernel-editor').evaluate((e) => getComputedStyle(e).color)
  expect(color).toBe(text)
  // görünüm değişikliği Markdown'a yansımaz
  await win.waitForTimeout(800)
  expect(readFileSync(join(vault, 'Gezegenler.md'), 'utf8').replace(/^---[\s\S]*?---\n/, '')).toBe('[[Mars]]\n\nBakınız [[Mars]] ve [[Yok]], ayrıca [[Gezegenler/Mars|yol ile]].\n')
  await app.close()
})
