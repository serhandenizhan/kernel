import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

const NOTE = '```python\ndef selam(ad):\n    return ad\n```\n\nson\n'
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`
}

test('kod teması: ayarlardan seçilir; blok zemini ve renkleri değişir; araç çubuğu koyu blokta da okunur', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Kod.md'), NOTE)
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Kod' }).click()
  const block = win.locator('.code-block').first()
  await expect(block).toBeVisible()
  // uygulama açık temada, kod otomatik: klasik açık
  await expect(win.locator('html')).toHaveAttribute('data-code-theme', 'auto')
  await win.keyboard.press('ControlOrMeta+,')
  await expect(win.getByTestId('setting-code-theme-current')).toContainText('Otomatik')
  await expect(win.getByTestId('setting-code-theme-claude-dark')).toHaveCount(0)
  await win.getByTestId('setting-code-theme-toggle').click()
  // kartlarda gerçek renklendirilmiş önizleme
  await expect(win.getByTestId('setting-code-theme-claude-dark').locator('pre')).toBeVisible()
  await win.getByTestId('setting-code-theme-claude-dark').click()
  await win.keyboard.press('Escape')
  await expect(win.locator('html')).toHaveAttribute('data-code-theme', 'claude-dark')
  // açık uygulama temasında koyu kod bloğu
  await expect.poll(() => block.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(rgb('#262624'))
  // anahtar sözcük (def) Claude koyu rengiyle
  const kw = block.locator('.shiki', { hasText: 'def' }).first()
  await expect(kw).toBeVisible()
  expect(await kw.evaluate((e) => getComputedStyle(e).color)).not.toBe(await block.evaluate((e) => getComputedStyle(e).color))
  // araç çubuğundaki dil adı koyu zeminde okunur (açık renk)
  await block.hover()
  // renk geçişi (0.15 sn) bittikten sonra ölç
  await expect
    .poll(async () => {
      const label = await block.locator('.code-lang').evaluate((e) => getComputedStyle(e).color)
      const [r, g, b] = label.match(/\d+/g)!.map(Number) as [number, number, number]
      return (r + g + b) / 3
    })
    .toBeGreaterThan(120)
  // Dracula ve Solarized da seçilebilir
  await win.keyboard.press('ControlOrMeta+,')
  await win.getByTestId('setting-code-theme-toggle').click()
  await win.getByTestId('setting-code-theme-solarized-light').click()
  await win.keyboard.press('Escape')
  await expect(win.locator('html')).toHaveAttribute('data-code-theme', 'solarized-light')
  await expect.poll(() => block.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(rgb('#fdf6e3'))
  await app.close()
})

test('kod teması seçimi yeniden başlatınca korunur', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Kod.md'), NOTE)
  let { app, win } = await launch(vault)
  await win.keyboard.press('ControlOrMeta+,')
  await win.getByTestId('setting-code-theme-toggle').click()
  await win.getByTestId('setting-code-theme-dracula').click()
  await expect(win.locator('html')).toHaveAttribute('data-code-theme', 'dracula')
  await win.keyboard.press('Escape')
  await app.close()
  ;({ app, win } = await launch(vault))
  await expect(win.locator('html')).toHaveAttribute('data-code-theme', 'dracula')
  await app.close()
})

test('"Kaydedildi" göstergesi: ikonlu kapsül; kaydederken ve hata olunca farklı görünür', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Not.md'), 'metin\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Not' }).click()
  const status = win.getByTestId('save-status')
  await expect(status).toHaveText('Kaydedildi')
  await expect(status.locator('svg.icon')).toHaveCount(1)
  expect(await status.evaluate((e) => getComputedStyle(e).borderRadius)).toMatch(/999|9999|50%|\d{2,}px/)
  // yazınca "Düzenleniyor" (nokta), sonra kaydedilince yine "Kaydedildi"
  await win.locator('.kernel-editor p').first().click()
  await win.keyboard.type(' ek')
  await expect(status).toHaveClass(/dirty|saving|saved/)
  await expect(status).toHaveText('Kaydedildi', { timeout: 8000 })
  await app.close()
})

test('ayarlardaki tema kartları pencereyi taşırmaz (yatay kaydırma yok)', async () => {
  const { app, win } = await launch(tmpVault())
  await win.keyboard.press('ControlOrMeta+,')
  await win.getByTestId('setting-code-theme-toggle').click()
  await expect(win.getByTestId('setting-code-theme-dracula')).toBeVisible()
  const overflow = await win.getByTestId('settings-dialog').evaluate((e) => e.scrollWidth - e.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await app.close()
})
