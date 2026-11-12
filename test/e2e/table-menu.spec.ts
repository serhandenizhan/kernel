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

test('hücreye sağ tıklayınca tablo menüsü açılır: tıklanan satırın üstüne satır, sağına sütun eklenir, satır silinir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Tablo.md'), '| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Tablo' }).click()
  const cell = (text: string) => win.locator('.kernel-editor td').filter({ hasText: new RegExp(`^${text}$`) })
  await cell('3').click({ button: 'right' })
  const menu = win.getByRole('menu')
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Üstüne satır ekle' }).click()
  await expect(menu).toBeHidden()
  await expect(win.locator('.kernel-editor tr')).toHaveCount(4)
  // yeni boş satır "1" ile "3" arasında
  await expect(win.locator('.kernel-editor tr').nth(2).locator('td').first()).toHaveText('')
  await expect(win.locator('.kernel-editor tr').nth(3).locator('td').first()).toHaveText('3')
  await cell('1').click({ button: 'right' })
  await win.getByRole('menu').getByRole('menuitem', { name: 'Sağına sütun ekle' }).click()
  await expect(win.locator('.kernel-editor tr').first().locator('th')).toHaveCount(3)
  await cell('3').click({ button: 'right' })
  await win.getByRole('menu').getByRole('menuitem', { name: 'Satırı sil' }).click()
  await expect(win.locator('.kernel-editor tr')).toHaveCount(3)
  await expect(cell('3')).toHaveCount(0)
  await expect.poll(() => readFileSync(join(vault, 'Tablo.md'), 'utf8'), { timeout: 5000 }).not.toContain('| 3')
  // tablo dışında sağ tık tablo menüsünü açmaz
  await app.close()
})
