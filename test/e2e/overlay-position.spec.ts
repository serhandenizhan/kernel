import { test, expect, type Locator } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

// Menüler imlecin / düğmenin yanında açılmalı (sayfa yüzeyinin cam efekti onları kaydırmamalı)
const box = async (l: Locator) => (await l.boundingBox())!

test('slash, [[ menüleri, simge seçici ve blok menüsü tetiklendiği yerde açılır', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'A.md'), 'metin\n')
  writeFileSync(join(vault, 'Hedef.md'), 'h\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'A' }).first().click()
  const para = win.getByText('metin')
  await para.click()
  await win.keyboard.press('End')
  await win.keyboard.press('Enter')
  const line = await box(para)

  await win.keyboard.type('/')
  const slash = await box(win.locator('.slash-menu'))
  expect(Math.abs(slash.x - line.x)).toBeLessThan(40)
  expect(slash.y - (line.y + line.height)).toBeLessThan(80)
  await win.keyboard.press('Escape')
  await win.keyboard.press('Backspace')

  await win.keyboard.type('[[hed')
  const wiki = await box(win.getByTestId('wiki-menu'))
  expect(Math.abs(wiki.x - line.x)).toBeLessThan(40)
  await win.keyboard.press('Escape')

  await win.getByTestId('page-title').hover()
  await win.getByTestId('add-icon').click({ force: true })
  const btn = await box(win.getByTestId('add-icon'))
  const picker = await box(win.locator('.icon-picker'))
  expect(Math.abs(picker.x - btn.x)).toBeLessThan(60)
  expect(Math.abs(picker.y - (btn.y + btn.height))).toBeLessThan(60)
  await win.keyboard.press('Escape')

  await para.hover()
  const handle = win.getByTestId('block-handle')
  await handle.click()
  const h = await box(handle)
  const menu = await box(win.locator('.menu').first())
  expect(Math.abs(menu.x - (h.x + h.width / 2))).toBeLessThan(60)
  expect(Math.abs(menu.y - (h.y + h.height / 2))).toBeLessThan(60)
  await app.close()
})

test('çalışma ekranı ana sayfa gibi kenar boşluklu çizilir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Kart.md'), 'Soru :: Cevap\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('nav-study').click()
  const surface = await box(win.locator('.page-surface').first())
  const row = await box(win.getByTestId('deck-row').first())
  expect(row.x - surface.x).toBeGreaterThan(40)
  expect(surface.x + surface.width - (row.x + row.width)).toBeGreaterThan(40)
  await app.close()
})

test('aramayla açılan iç içe sayfa kenar çubuğunda görünür olur (üst klasör açılır)', async () => {
  const vault = tmpVault()
  mkdirSync(join(vault, 'Dersler'))
  writeFileSync(join(vault, 'Dersler.md'), 'ders\n')
  writeFileSync(join(vault, 'Dersler', 'Olasılık.md'), 'bayes kuralı\n')
  const { app, win } = await launch(vault)
  await expect(win.getByTestId('tree-row').filter({ hasText: 'Olasılık' })).toHaveCount(0)
  await win.keyboard.press('ControlOrMeta+k')
  await win.keyboard.type('bayes')
  await win.waitForTimeout(400)
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('page-title')).toHaveValue('Olasılık')
  const row = win.getByTestId('tree-row').filter({ hasText: 'Olasılık' })
  await expect(row).toBeVisible()
  await expect(row).toHaveClass(/active/)
  await app.close()
})
