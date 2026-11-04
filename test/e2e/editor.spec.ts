import { test, expect, type Page } from '@playwright/test'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './helpers/app'

const body = (vault: string, file: string) => readFileSync(join(vault, file), 'utf8').replace(/^---[\s\S]*?---\n/, '')

async function newPage(win: Page, title: string, vault?: string) {
  await win.getByTestId('new-page').click()
  const t = win.getByTestId('page-title')
  await t.fill(title)
  await t.press('Enter')
  // yeniden adlandırma diske yansıyana kadar bekle
  if (vault) await expect.poll(() => existsSync(join(vault, `${title}.md`))).toBe(true)
}

test('yazılan içerik Markdown olarak kaydedilir', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, 'Notlar', vault)
  await win.keyboard.type('Merhaba **dünya** ')
  await expect.poll(() => { try { return body(vault, 'Notlar.md') } catch { return '' } }, { timeout: 5000 }).toBe('Merhaba **dünya**\n')
  await expect(win.getByTestId('save-status')).toHaveText('Kaydedildi')
  await app.close()
})

test('yazıp hemen kapatınca son karakter de kaydedilir', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, 'Hızlı', vault)
  await win.getByTestId('editor').click()
  await win.keyboard.type('son harf: Z')
  await app.close()
  expect(body(vault, 'Hızlı.md')).toBe('son harf: Z\n')
})

test('dışarıdan değişen dosya temiz editörde yeniden yüklenir', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, 'Dış', vault)
  await win.keyboard.type('ilk')
  const file = join(vault, 'Dış.md')
  await expect.poll(() => body(vault, 'Dış.md'), { timeout: 5000 }).toBe('ilk\n')
  const text = readFileSync(file, 'utf8').replace(/\nilk\n?$/, '\ndışarıdan geldi\n')
  writeFileSync(file, text)
  await expect(win.getByTestId('editor')).toContainText('dışarıdan geldi', { timeout: 5000 })
  await app.close()
})

test('ikili dosya salt okunur açılır ve diske yazılmaz', async () => {
  const { app, win, vault } = await launch()
  writeFileSync(join(vault, 'Bozuk.md'), 'metin\u0000ikili')
  await win.reload()
  await win.getByTestId('tree-row').filter({ hasText: 'Bozuk' }).click()
  await expect(win.getByTestId('readonly-banner')).toBeVisible()
  const before = statSync(join(vault, 'Bozuk.md')).mtimeMs
  await win.waitForTimeout(1200)
  expect(statSync(join(vault, 'Bozuk.md')).mtimeMs).toBe(before)
  await app.close()
})
