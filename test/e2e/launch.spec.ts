import { test, expect } from '@playwright/test'
import { launch } from './helpers/app'

test('pencere güvenli ayarlarla açılır', async () => {
  const { app, win } = await launch()
  expect(await win.title()).toBe('Kernel')
  const prefs = await app.evaluate(({ BrowserWindow }) => (BrowserWindow.getAllWindows()[0]!.webContents as unknown as { getLastWebPreferences(): object }).getLastWebPreferences())
  expect(prefs).toMatchObject({ contextIsolation: true, nodeIntegration: false, sandbox: true })
  expect(await win.evaluate(() => typeof (globalThis as unknown as { require?: unknown }).require)).toBe('undefined')
  await app.close()
})
