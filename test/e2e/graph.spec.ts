import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('graf tüm sayfaları ve linkleri gösterir; yerel graf komşularla sınırlı; düğüm sayfayı açar', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'A.md'), '[[B]] ve [[C]]\n')
  writeFileSync(join(vault, 'B.md'), '[[C]]\n')
  writeFileSync(join(vault, 'C.md'), 'c\n')
  writeFileSync(join(vault, 'D.md'), 'yalnız\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('nav-graph').click()
  await expect(win.getByTestId('graph-stats')).toHaveText('4 sayfa · 3 bağlantı')
  await expect(win.locator('.graph-canvas')).toBeVisible()

  await win.getByTestId('tree-row').filter({ hasText: 'D' }).click()
  await win.keyboard.press('Meta+p')
  await win.getByTestId('command-input').fill('bu sayfanın grafı')
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('graph-stats')).toHaveText('1 sayfa · 0 bağlantı')
  await win.getByTestId('graph-global').click()
  await expect(win.getByTestId('graph-stats')).toHaveText('4 sayfa · 3 bağlantı')

  // düğümler klavyeyle de açılabilir (ekran okuyucu listesi)
  await win.getByTestId('graph-node').filter({ hasText: 'B' }).focus()
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('page-title')).toHaveValue('B')
  await app.close()
})
