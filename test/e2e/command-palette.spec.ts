import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('Cmd+P komut paletini açar; aranan komut kısayoluyla görünür ve çalışır', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Ana.md'), 'metin\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Ana' }).click()
  await win.keyboard.press('ControlOrMeta+p')
  await expect(win.getByTestId('command-palette')).toBeVisible()
  await win.getByTestId('command-input').fill('odak')
  const row = win.getByTestId('command-row').first()
  await expect(row).toContainText('Odak modu')
  await expect(row).toContainText('⌘⇧F')
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('command-palette')).toBeHidden()
  await expect(win.locator('.app')).toHaveClass(/focus-mode/)
  await expect(win.getByTestId('sidebar')).toBeHidden()
  // aynı kısayol odak modundan çıkarır
  await win.keyboard.press('ControlOrMeta+Shift+f')
  await expect(win.locator('.app')).not.toHaveClass(/focus-mode/)
  await expect(win.getByTestId('sidebar')).toBeVisible()

  // komutla ayarlar açılır; Esc paleti kapatır
  await win.keyboard.press('ControlOrMeta+p')
  await win.getByTestId('command-input').fill('ayar')
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('settings-dialog')).toBeVisible()
  await win.keyboard.press('Escape')
  await win.keyboard.press('ControlOrMeta+p')
  await win.keyboard.press('Escape')
  await expect(win.getByTestId('command-palette')).toBeHidden()
  await app.close()
})
