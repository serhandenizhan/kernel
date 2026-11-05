import { test, expect } from '@playwright/test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('Yeni menüsü: dört öğe, ders notu şablonu, klavye ve Esc; Yeni düğmesi doğrudan boş sayfa açar', async () => {
  const vault = tmpVault()
  const { app, win } = await launch(vault)
  await expect(win.getByTestId('sidebar-brand')).toContainText('Kernel')
  await win.getByTestId('new-menu').click()
  for (const id of ['new-blank', 'new-lecture', 'new-from-template', 'notion-import']) await expect(win.getByTestId(id)).toBeVisible()
  await win.keyboard.press('Escape')
  await expect(win.getByTestId('new-blank')).toHaveCount(0)

  await win.getByTestId('new-menu').click()
  await win.getByTestId('new-lecture').click()
  await expect(win.getByTestId('editor')).toContainText('Önemli kavramlar')
  await expect.poll(() => readdirSync(vault).some((f) => /^Ders notu .*\.md$/.test(f))).toBe(true)

  // klavye: ↓ ile ilk öğe (Boş sayfa), Enter
  await win.getByTestId('new-menu').click()
  await win.keyboard.press('ArrowDown')
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('page-title')).toHaveValue('')

  await win.getByTestId('new-page').click()
  await expect(win.getByTestId('page-title')).toHaveValue('')
  await expect.poll(() => existsSync(join(vault, 'Adsız.md')) || readdirSync(vault).filter((f) => f.startsWith('Adsız')).length >= 2).toBe(true)
  expect(readFileSync(join(vault, readdirSync(vault).find((f) => f.startsWith('Ders notu'))!), 'utf8')).toContain('## Konu')
  await app.close()
})
