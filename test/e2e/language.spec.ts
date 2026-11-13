import { test, expect } from '@playwright/test'
import { launch } from './helpers/app'

test('dil yeniden başlatmadan değişir; Almanca etiketler taşmaz', async () => {
  const { app, win } = await launch()
  await win.getByRole('button', { name: 'Ayarlar' }).click()
  await win.getByTestId('setting-language-en').click()
  await expect(win.getByTestId('sidebar')).toContainText('Settings')
  await expect(win.getByTestId('settings-dialog')).toContainText('Language')
  await win.getByTestId('setting-language-de').click()
  await expect(win.getByTestId('sidebar')).toContainText('Einstellungen')
  const overflow = await win.evaluate(
    () =>
      [...document.querySelectorAll('[data-testid="sidebar"] button, [data-testid="sidebar"] a, .settings label, .settings button')].filter(
        (e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis'
      ).length
  )
  expect(overflow).toBe(0)
  await app.close()
})

test('not yazı tipi ve açılış görünümü segment kontrolleriyle değişir', async () => {
  const { app, win } = await launch()
  await win.keyboard.press('ControlOrMeta+,')
  await win.getByTestId('setting-font-toggle').click()
  await win.getByTestId('setting-font-serif').click()
  await expect(win.locator('html')).toHaveAttribute('data-body-font', 'serif')
  await win.getByTestId('setting-start-home').click()
  await expect(win.getByTestId('setting-start-home')).toHaveAttribute('aria-checked', 'true')
  await app.close()
})
