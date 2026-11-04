import { test, expect, type Page } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

const bodyOf = (vault: string, file: string) => readFileSync(join(vault, file), 'utf8').replace(/^---[\s\S]*?---\n/, '')

async function newPage(win: Page, vault: string, title: string) {
  await win.getByTestId('new-page').click()
  await expect(win.getByTestId('page-title')).toHaveValue('')
  await win.getByTestId('page-title').fill(title)
  await win.getByTestId('page-title').press('Enter')
  await expect.poll(() => existsSync(join(vault, `${title}.md`))).toBe(true)
}

test('$…$ yazınca satır içi formül olur, para birimi olmaz', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Dolar')
  await win.keyboard.type('alan $x^2$ olur. ')
  await expect(win.locator('.kernel-editor .katex')).toHaveCount(1)
  await win.keyboard.type('Bilet 5$ ile 10$ arası.')
  await expect(win.locator('.kernel-editor .katex')).toHaveCount(1)
  await expect.poll(() => bodyOf(vault, 'Dolar.md'), { timeout: 5000 }).toBe('alan $x^2$ olur. Bilet 5\\$ ile 10\\$ arası.\n')
  await app.close()
})

test('çakışma penceresi açıkken bekleyen kayıt dış değişikliğin üzerine yazmaz', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Çakışma')
  await win.keyboard.type('ilk')
  await expect.poll(() => bodyOf(vault, 'Çakışma.md'), { timeout: 5000 }).toBe('ilk\n')
  const file = join(vault, 'Çakışma.md')
  // editörü kirlet ve hemen dışarıdan değiştir
  await win.keyboard.type(' benim')
  writeFileSync(file, readFileSync(file, 'utf8').replace(/ilk\n$/, 'dışarıdan\n'))
  await expect(win.getByRole('dialog', { name: /Dosya dışarıda değişti/ })).toBeVisible({ timeout: 5000 })
  await win.waitForTimeout(1500)
  expect(bodyOf(vault, 'Çakışma.md')).toBe('dışarıdan\n')
  await win.getByRole('button', { name: 'Diskteki sürümü yükle' }).click()
  await expect(win.getByTestId('editor')).toHaveText('dışarıdan')
  await win.waitForTimeout(1200)
  expect(bodyOf(vault, 'Çakışma.md')).toBe('dışarıdan\n')
  await app.close()
})

test('yazıp hemen başka sayfaya geçince metin kaybolmaz', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Diğer.md'), 'diğer\n')
  const { app, win } = await launch(vault)
  await newPage(win, vault, 'Hızlı geçiş')
  await win.keyboard.type('kaybolmasın')
  await win.getByTestId('tree-row').filter({ hasText: 'Diğer' }).click()
  await expect.poll(() => bodyOf(vault, 'Hızlı geçiş.md'), { timeout: 5000 }).toBe('kaybolmasın\n')
  await app.close()
})

test('Obsidian frontmatter alanları düzenleme sonrası korunur', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Obs.md'), '---\naliases: [takma]\n---\nmetin\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Obs' }).click()
  await win.getByText('metin').click()
  await win.keyboard.press('End')
  await win.keyboard.type('!')
  await expect.poll(() => readFileSync(join(vault, 'Obs.md'), 'utf8'), { timeout: 5000 }).toContain('metin!')
  expect(readFileSync(join(vault, 'Obs.md'), 'utf8')).toContain('aliases:')
  await app.close()
})
