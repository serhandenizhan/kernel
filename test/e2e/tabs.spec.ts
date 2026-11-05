import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('Cmd+tık yeni sekme açar, Cmd+W sekmeyi kapatır; sekme sağa sürüklenince ekran bölünür; sekmeler hatırlanır', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Alfa.md'), 'alfa metni\n')
  writeFileSync(join(vault, 'Beta.md'), 'beta metni\n')
  writeFileSync(join(vault, 'Gama.md'), 'gama metni\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Alfa' }).click()
  await expect(win.getByTestId('tab')).toHaveCount(0) // tek sayfa: sekme çubuğu yok
  await win.getByTestId('tree-row').filter({ hasText: 'Beta' }).click({ modifiers: ['Meta'] })
  await expect(win.getByTestId('tab')).toHaveText([/Alfa/, /Beta/])
  await expect(win.getByTestId('page-title')).toHaveValue('Beta')
  // normal tık etkin sekmede açar
  await win.getByTestId('tree-row').filter({ hasText: 'Gama' }).click()
  await expect(win.getByTestId('tab')).toHaveText([/Alfa/, /Gama/])
  await win.getByTestId('tab').first().click()
  await expect(win.getByTestId('page-title')).toHaveValue('Alfa')

  // sekmeyi sağa sürükle: yan yana iki sayfa
  await win.getByTestId('tab').nth(1).dragTo(win.getByTestId('split-drop'), { force: true })
  await expect(win.getByTestId('split-pane')).toBeVisible()
  await expect(win.getByTestId('split-pane').getByTestId('page-title')).toHaveValue('Gama')
  await win.getByTestId('split-pane').getByText('gama metni').click()
  await win.keyboard.press('End')
  await win.keyboard.type('!')
  await expect.poll(() => readFileSync(join(vault, 'Gama.md'), 'utf8'), { timeout: 5000 }).toContain('gama metni!')
  await win.getByTestId('split-close').click()
  await expect(win.getByTestId('split-pane')).toHaveCount(0)

  // hatırlanır
  await win.reload()
  await expect(win.getByTestId('tab')).toHaveText([/Alfa/, /Gama/])
  await win.getByTestId('tab').first().click()
  await win.keyboard.press('Meta+w')
  await expect(win.getByTestId('tab')).toHaveCount(0)
  await expect(win.getByTestId('page-title')).toHaveValue('Gama')
  await app.close()
})
