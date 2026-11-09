import { test, expect } from '@playwright/test'
import { launch, tmpVault } from './helpers/app'

// Testler kullanıcının ekranını ve odağını çalmasın: pencere gösterilmez, Dock'ta görünmez
test('test sırasında pencere gizli kalır ve uygulama yine çalışır', async () => {
  test.skip(!!process.env['KERNEL_TEST_SHOW'] || !!process.env['KERNEL_SCREENSHOTS'], 'pencere bilerek görünür')
  const { app, win } = await launch(tmpVault())
  const visible = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some((w) => w.isVisible()))
  expect(visible).toBe(false)
  await expect(win.getByTestId('sidebar')).toBeVisible()
  await app.close()
})
