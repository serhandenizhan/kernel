import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('metin araç çubuğundan link eklenir, düzenlenir ve kaldırılır', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Not.md'), 'kelime\n')
  const { app, win } = await launch(vault)
  try {
    await win.getByTestId('tree-row').filter({ hasText: 'Not' }).click()
    await win.locator('.kernel-editor p').first().dblclick()
    await expect(win.getByTestId('bubble-toolbar')).toBeVisible()
    await win.getByTestId('bubble-link').click()
    const input = win.getByTestId('bubble-link-input')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    // Esc değişikliği iptal eder ve seçimi korur
    await input.fill('https://iptal.example')
    await input.press('Escape')
    await expect(input).toHaveCount(0)
    await expect(win.locator('.kernel-editor a')).toHaveCount(0)
    await expect(win.getByTestId('bubble-toolbar')).toBeVisible()

    await win.getByTestId('bubble-link').click()
    await expect(input).toBeVisible()
    await input.fill('https://example.com')
    await input.press('Enter')
    await expect.poll(() => readFileSync(join(vault, 'Not.md'), 'utf8'), { timeout: 5000 }).toContain('[kelime](https://example.com)')

    // mevcut link dolu gelir; boş bırakılıp Enter'a basılınca kaldırılır
    await win.locator('.kernel-editor a').dblclick()
    await expect(win.getByTestId('bubble-toolbar')).toBeVisible()
    await win.getByTestId('bubble-link').click()
    await expect(input).toHaveValue('https://example.com')
    await input.fill('')
    await input.press('Enter')
    await expect.poll(() => readFileSync(join(vault, 'Not.md'), 'utf8'), { timeout: 5000 }).not.toContain('https://example.com')
    expect(readFileSync(join(vault, 'Not.md'), 'utf8')).toContain('kelime')
  } finally {
    await app.close()
  }
})

test('callout menüsünden özel ikon değiştirilir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Callout.md'), '> [!note] Başlık\n> gövde\n')
  const { app, win } = await launch(vault)
  try {
    await win.getByTestId('tree-row').filter({ hasText: 'Callout' }).click()
    await win.locator('.callout-icon').click()
    await win.getByRole('menuitem', { name: 'Özel ikon…' }).click()
    const input = win.getByTestId('callout-icon-input')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    await input.fill('🚀')
    await input.press('Enter')
    await expect(win.locator('.callout-icon')).toHaveText('🚀')
    await expect.poll(() => readFileSync(join(vault, 'Callout.md'), 'utf8'), { timeout: 5000 }).toContain('> [!note|🚀]')
  } finally {
    await app.close()
  }
})
