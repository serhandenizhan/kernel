import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('tabloda araç çubuğu sürekli açık durmaz: küçük düğme açar, satır ekler, tablodan çıkınca kapanır', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Tablo.md'), 'giriş\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nson\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Tablo' }).click()
  await win.locator('.kernel-editor td').first().click()
  const toggle = win.getByTestId('table-menu-toggle')
  await expect(toggle).toBeVisible()
  await expect(win.getByTestId('table-add-row')).toHaveCount(0)
  await toggle.click()
  await win.getByTestId('table-add-row').click()
  await expect(win.locator('.kernel-editor tr')).toHaveCount(3)
  await expect.poll(() => readFileSync(join(vault, 'Tablo.md'), 'utf8').split('\n').filter((l) => l.startsWith('|')).length, { timeout: 5000 }).toBe(4)
  // tablodan çıkınca düğme de gider; geri dönünce menü kapalı başlar
  await win.getByText('son').click()
  await expect(toggle).toBeHidden()
  await win.locator('.kernel-editor td').first().click()
  await expect(toggle).toBeVisible()
  await expect(win.getByTestId('table-add-row')).toHaveCount(0)
  await app.close()
})
