import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('⌘F / Ctrl+F sayfa içinde arar: eşleşmeler vurgulanır, sayaç ilerler, Esc kapatır', async () => {
  const vault = tmpVault()
  const filler = Array.from({ length: 40 }, (_, i) => `Dolgu satırı ${i}`).join('\n\n')
  writeFileSync(join(vault, 'Fizik.md'), `# İvme\n\nHız ve ivme ilişkisi.\n\n${filler}\n\nSon paragrafta da ivme geçer.\n`)
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Fizik' }).click()
  await expect(win.locator('.kernel-editor h1')).toBeVisible()
  await win.keyboard.press('ControlOrMeta+f')
  const bar = win.getByTestId('find-bar')
  await expect(bar).toBeVisible()
  await expect(win.getByTestId('find-input')).toBeFocused()
  await win.keyboard.type('ivme')
  // "İvme" (başlık), "ivme" ve "ivme": 3 eşleşme, Türkçe harfe duyarsız
  await expect(win.locator('.kernel-editor .find-match')).toHaveCount(3)
  await expect(win.getByTestId('find-count')).toHaveText('1/3')
  await expect(win.locator('.kernel-editor .find-current')).toHaveText('İvme')
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('find-count')).toHaveText('2/3')
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('find-count')).toHaveText('3/3')
  // son eşleşme sayfanın altında: görünür alana kaydırılır
  await expect(win.locator('.kernel-editor .find-current')).toBeInViewport()
  await win.keyboard.press('Shift+Enter')
  await expect(win.getByTestId('find-count')).toHaveText('2/3')
  await win.getByTestId('find-input').fill('yokböylebirşey')
  await expect(win.getByTestId('find-count')).toHaveText('0/0')
  await expect(win.locator('.kernel-editor .find-match')).toHaveCount(0)
  await win.keyboard.press('Escape')
  await expect(bar).toHaveCount(0)
  await expect(win.locator('.kernel-editor .find-match')).toHaveCount(0)
  // dosya değişmez
  await app.close()
})

test('2+ sekmede ⌘F açılınca sayfa yüzeyi pencerenin altına taşmaz ve son paragraf görünür', async () => {
  const vault = tmpVault()
  const filler = Array.from({ length: 40 }, (_, i) => `Dolgu satırı ${i}`).join('\n\n')
  writeFileSync(join(vault, 'Alfa.md'), 'alfa\n')
  writeFileSync(join(vault, 'Uzun.md'), `# Uzun\n\n${filler}\n\nBİTİŞ PARAGRAFI\n`)
  const { app, win } = await launch(vault)
  try {
    await win.getByTestId('tree-row').filter({ hasText: 'Alfa' }).click()
    await win.getByTestId('tree-row').filter({ hasText: 'Uzun' }).click({ modifiers: ['ControlOrMeta'] })
    await expect(win.getByTestId('tab')).toHaveCount(2)
    await win.keyboard.press('ControlOrMeta+f')
    await expect(win.getByTestId('find-bar')).toBeVisible()

    const geom = await win.evaluate(() => {
      const s = document.querySelector('.surfaces')!.getBoundingClientRect()
      return { bottom: Math.round(s.bottom), winH: window.innerHeight }
    })
    expect(geom.bottom).toBeLessThanOrEqual(geom.winH)

    await win.locator('.page-surface').evaluate((el) => (el.scrollTop = el.scrollHeight))
    await expect(win.locator('.kernel-editor').getByText('BİTİŞ PARAGRAFI')).toBeInViewport()
  } finally {
    await app.close()
  }
})
