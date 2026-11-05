import { test, expect } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('[[ yazınca sayfa seçici açılır; seçilen sayfa link olarak kaydedilir; aynı adlı sayfa yol ile yazılır', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Ana.md'), 'başlangıç\n')
  writeFileSync(join(vault, 'Özdeğerler.md'), 'öz\n')
  mkdirSync(join(vault, 'Fizik'))
  mkdirSync(join(vault, 'Kimya'))
  writeFileSync(join(vault, 'Fizik.md'), '')
  writeFileSync(join(vault, 'Kimya.md'), '')
  writeFileSync(join(vault, 'Fizik', 'Notlar.md'), '')
  writeFileSync(join(vault, 'Kimya', 'Notlar.md'), '')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Ana' }).click()
  await win.getByText('başlangıç', { exact: true }).click()
  await win.keyboard.press('End')
  await win.keyboard.type(' [[ozde')
  await expect(win.getByTestId('wiki-menu')).toBeVisible()
  await expect(win.getByTestId('wiki-item').first()).toContainText('Özdeğerler')
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('wiki-menu')).toBeHidden()
  await expect(win.locator('.wiki-link')).toHaveText('Özdeğerler')

  await win.keyboard.type('ve [[notlar')
  await expect(win.getByTestId('wiki-item')).toHaveCount(2) // tam eşleşme var: oluştur maddesi yok
  await win.getByTestId('wiki-item').filter({ hasText: 'Kimya/Notlar' }).click()
  await expect.poll(() => readFileSync(join(vault, 'Ana.md'), 'utf8'), { timeout: 5000 }).toContain('[[Özdeğerler]] ve [[Kimya/Notlar]]')

  // eşleşme yoksa "oluştur" maddesi; link eklenir, tıklanınca sayfa oluşur
  await win.keyboard.type('[[Yepyeni Konu')
  await expect(win.getByTestId('wiki-item')).toContainText('“Yepyeni Konu” sayfasını oluştur')
  await win.keyboard.press('Enter')
  await expect.poll(() => readFileSync(join(vault, 'Ana.md'), 'utf8'), { timeout: 5000 }).toContain('[[Yepyeni Konu]]')
  await win.keyboard.press('Escape')
  await app.close()
})
