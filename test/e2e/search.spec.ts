import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('Cmd+K ile içerik aranır ve sayfa açılır', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Özdeğerler.md'), 'karakteristik polinom kökleri\n')
  writeFileSync(join(vault, 'Fizik.md'), 'Newton yasaları\n')
  const { app, win } = await launch(vault)
  await win.keyboard.press('ControlOrMeta+k')
  const input = win.getByTestId('search-input')
  await expect(input).toBeFocused()
  await input.fill('KARAKTERISTIK')
  await expect(win.getByTestId('search-result').first()).toContainText('Özdeğerler')
  await expect(win.getByTestId('search-result').first()).toContainText('karakteristik polinom')
  await input.press('Enter')
  await expect(win.getByTestId('page-title')).toHaveValue('Özdeğerler')
  await expect(win.getByTestId('search-input')).toHaveCount(0)
  // boş sorguda son açılanlar
  await win.keyboard.press('ControlOrMeta+k')
  await expect(win.getByTestId('search-result').first()).toContainText('Özdeğerler')
  await win.keyboard.press('Escape')
  await expect(win.getByTestId('search-input')).toHaveCount(0)
  await app.close()
})
