import { test, expect } from '@playwright/test'
import { launch } from './helpers/app'

test('rehber: sayfa içi arama, blok türü, kod temaları ve kapaklar / Unsplash bölümleri anlatılır', async () => {
  const { app, win } = await launch()
  await win.keyboard.press('ControlOrMeta+/')
  const guide = win.getByTestId('guide')
  await expect(guide).toBeVisible()
  for (const [id, text] of [
    ['find', 'Enter'],
    ['blocktype', 'Dönüştür'],
    ['codetheme', 'Claude'],
    ['covers', 'Access Key']
  ] as const) {
    const sec = win.getByTestId(`guide-${id}`)
    await expect(sec).toBeVisible()
    await expect(sec).toContainText(text)
  }
  await app.close()
})
