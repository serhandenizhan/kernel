import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('uzun notta degrade pencereye sabit: kaydırınca metnin arkası koyulaşmaz', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Uzun.md'), Array.from({ length: 200 }, (_, i) => `Satır ${i} gezegen yörüngesi.`).join('\n\n'))
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Uzun' }).click()
  const surface = win.locator('.page-surface')
  expect(await surface.evaluate((e) => getComputedStyle(e).backgroundAttachment)).toContain('fixed')
  expect(await surface.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('linear-gradient')
  // aurora pencere zemininde
  expect(await win.locator('.app').evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('radial-gradient')
  await app.close()
})

test('saydamlığı azalt: aurora ve degrade kapanır', async () => {
  const { app, win } = await launch()
  await win.emulateMedia({ forcedColors: 'none' })
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.debugger.attach('1.3'))
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] })
  )
  expect(await win.locator('.app').evaluate((e) => getComputedStyle(e).backgroundImage)).toBe('none')
  await app.close()
})
