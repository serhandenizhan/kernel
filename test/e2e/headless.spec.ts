import { test, expect } from '@playwright/test'
import { launch, tmpVault } from './helpers/app'

// Testler kullanıcının ekranını ve odağını çalmasın: pencere gösterilmez, Dock'ta görünmez
test('test sırasında pencere görünmez kalır, odak almaz ve uygulama yine çalışır', async () => {
  test.skip(!!process.env['KERNEL_TEST_SHOW'] || !!process.env['KERNEL_SCREENSHOTS'], 'pencere bilerek görünür')
  const { app, win } = await launch(tmpVault())
  // pencere çizilir (tuşlar çalışsın) ama görünmezdir, tıklamaları geçirir ve odak almaz
  const state = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((w) => ({ opacity: w.getOpacity(), focused: w.isFocused() })))
  expect(state.length).toBeGreaterThan(0)
  for (const w of state) {
    expect(w.opacity).toBe(0)
    expect(w.focused).toBe(false)
  }
  await expect(win.getByTestId('sidebar')).toBeVisible()
  await app.close()
})
