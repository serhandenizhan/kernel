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
  await win.keyboard.press('ControlOrMeta+p')
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

test('5.9b: ayarlar modalına tıklayınca arka plandaki graf düğümü açılmaz', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Tek.md'), 'tek sayfa\n')
  const { app, win } = await launch(vault)
  try {
    await win.getByTestId('nav-graph').click()
    await expect(win.locator('.graph-canvas')).toBeVisible()
    // tek düğüm simülasyonun merkezine otursun
    await win.waitForTimeout(450)
    const canvasBox = (await win.locator('.graph-canvas').boundingBox())!
    const cx = canvasBox.x + canvasBox.width / 2
    const cy = canvasBox.y + canvasBox.height / 2

    await win.keyboard.press('ControlOrMeta+,')
    await expect(win.getByTestId('settings-dialog')).toBeVisible()
    const modalBox = (await win.getByTestId('settings-dialog').boundingBox())!
    // tuval merkezi ayarlar penceresinin içinde olsun (backdrop değil)
    expect(cx).toBeGreaterThan(modalBox.x)
    expect(cx).toBeLessThan(modalBox.x + modalBox.width)
    expect(cy).toBeGreaterThan(modalBox.y)
    expect(cy).toBeLessThan(modalBox.y + modalBox.height)

    await win.mouse.click(cx, cy)
    await win.keyboard.press('Escape')
    await expect(win.getByTestId('settings-dialog')).toHaveCount(0)
    await expect(win.locator('.graph-canvas')).toBeVisible()
  } finally {
    await app.close()
  }
})
