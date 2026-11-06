import { test, expect, type Page } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

const body = (vault: string, file: string) => readFileSync(join(vault, file), 'utf8').replace(/^---[\s\S]*?---\n/, '')

async function paste(win: Page, text: string) {
  await win.evaluate((text) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', text)
    ;(document.activeElement ?? document.querySelector('.kernel-editor')!).dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, text)
}

test('kod bloğuna çitli kod yapıştırınca çitler atılır, dil atanır ve diyagram çizilir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Kod.md'), 'giriş\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Kod' }).click()
  await win.getByText('giriş').click()
  await win.keyboard.press('End')
  await win.keyboard.press('Enter')
  await win.keyboard.type('``` ')
  await paste(win, '```mermaid\nflowchart LR\n  Alfa --> Beta\n```')
  await expect(win.locator('.mermaid-preview svg')).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => body(vault, 'Kod.md'), { timeout: 5000 }).toContain('```mermaid\nflowchart LR\n  Alfa --> Beta\n```')
  expect(body(vault, 'Kod.md')).not.toContain('```mermaid\n```mermaid')
  await app.close()
})

test('"/" menüsünden soru-cevap kartı ve katlanır kart eklenir; çalışma ekranında görünür', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Kart.md'), 'giriş\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Kart' }).click()
  await win.getByText('giriş').click()
  await win.keyboard.press('End')
  await win.keyboard.press('Enter')
  await win.keyboard.type('/kart')
  await expect(win.getByTestId('slash-item').first()).toContainText('Soru-cevap kartı')
  await win.keyboard.press('Enter')
  // soru seçili gelir: yazınca yerine geçer
  await win.keyboard.type('Başkent')
  await win.keyboard.press('End')
  await win.keyboard.press('Shift+Home')
  await expect.poll(() => body(vault, 'Kart.md'), { timeout: 5000 }).toContain('Başkent :: Cevap')
  await win.keyboard.press('End')
  await win.keyboard.press('Enter')
  await win.keyboard.type('/katlan')
  await win.getByTestId('slash-item').filter({ hasText: 'Katlanır kart' }).click()
  await win.keyboard.type('En büyük gezegen')
  await win.keyboard.press('Enter')
  await win.keyboard.type('Jüpiter')
  await expect.poll(() => body(vault, 'Kart.md'), { timeout: 5000 }).toContain('data-card')
  await win.getByTestId('nav-study').click()
  await expect(win.getByTestId('deck-row').first()).toContainText('2')
  await app.close()
})

test('içindekiler: sağ kenarda başlık çizgileri, üzerine gelince liste açılır ve tıklayınca kaydırır', async () => {
  const vault = tmpVault()
  const filler = Array.from({ length: 40 }, (_, i) => `Paragraf ${i}`).join('\n\n')
  writeFileSync(join(vault, 'Uzun.md'), `# Giriş\n\n${filler}\n\n## Orta\n\n${filler}\n\n### Son bölüm\n\nbitiş\n`)
  writeFileSync(join(vault, 'Kısa.md'), '# Tek başlık\n\nmetin\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Kısa' }).click()
  await expect(win.getByTestId('toc-rail')).toHaveCount(0)
  await win.getByTestId('tree-row').filter({ hasText: 'Uzun' }).click()
  const rail = win.getByTestId('toc-rail')
  await expect(rail.getByTestId('toc-line')).toHaveCount(3)
  await expect(rail.getByTestId('toc-item').first()).toBeHidden()
  await rail.hover()
  await expect(rail.getByTestId('toc-item')).toHaveCount(3)
  await expect(rail.getByTestId('toc-item').nth(2)).toBeVisible()
  await rail.getByTestId('toc-item').nth(2).click()
  await expect.poll(() => win.locator('.page-surface').evaluate((e) => e.scrollTop)).toBeGreaterThan(500)
  // sabit panel açıkken şerit gizlenir
  await win.keyboard.press('ControlOrMeta+Shift+t')
  await expect(win.getByTestId('toc-rail')).toHaveCount(0)
  await app.close()
})
