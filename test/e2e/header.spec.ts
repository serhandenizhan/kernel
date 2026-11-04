import { test, expect, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './helpers/app'

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')
const fileOf = (vault: string, name: string) => readFileSync(join(vault, `${name}.md`), 'utf8')

async function newPage(win: Page, vault: string, title: string) {
  await win.getByTestId('new-page').click()
  await expect(win.getByTestId('page-title')).toHaveValue('')
  await win.getByTestId('page-title').fill(title)
  await win.getByTestId('page-title').press('Enter')
  await expect.poll(() => existsSync(join(vault, `${title}.md`))).toBe(true)
}

test('emoji ikon seçilir, dosyaya ve kenar çubuğuna yansır', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Matematik')
  await win.getByTestId('page-title').hover()
  await win.getByTestId('add-icon').click()
  await win.getByTestId('icon-search').fill('abaküs')
  await win.getByTestId('emoji-option').first().click()
  await expect.poll(() => fileOf(vault, 'Matematik'), { timeout: 5000 }).toMatch(/icon: "?🧮"?/)
  await expect(win.getByTestId('tree-row').filter({ hasText: 'Matematik' })).toContainText('🧮')
  // ikon kaldırma
  await win.getByTestId('page-icon').click()
  await win.getByTestId('icon-remove').click()
  await expect.poll(() => fileOf(vault, 'Matematik'), { timeout: 5000 }).not.toContain('icon:')
  await app.close()
})

test('hazır kapak eklenir ve değiştirilir', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Kapaklı')
  await win.getByTestId('page-title').hover()
  await win.getByTestId('add-cover').click()
  await expect(win.getByTestId('page-cover')).toBeVisible()
  await expect.poll(() => fileOf(vault, 'Kapaklı'), { timeout: 5000 }).toMatch(/cover: kernel:/)
  await win.getByTestId('page-cover').hover()
  await win.getByTestId('cover-change').click()
  await win.getByTestId('cover-preset-kernel:night').click()
  await expect.poll(() => fileOf(vault, 'Kapaklı'), { timeout: 5000 }).toContain('cover: kernel:night')
  await app.close()
})

test('görsel kapak yüklenir ve konumlandırılır', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Görselli')
  await win.getByTestId('page-title').hover()
  await win.getByTestId('add-cover').click()
  await win.getByTestId('page-cover').hover()
  await win.getByTestId('cover-change').click()
  await win.getByTestId('cover-upload').setInputFiles({ name: 'kapak.png', mimeType: 'image/png', buffer: PNG_1x1 })
  await expect.poll(() => fileOf(vault, 'Görselli'), { timeout: 5000 }).toMatch(/cover: attachments\/kapak-\w+\.png/)
  await win.getByTestId('page-cover').hover()
  await win.getByTestId('cover-reposition').click()
  const box = (await win.getByTestId('page-cover').boundingBox())!
  await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await win.mouse.down()
  await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 60, { steps: 5 })
  await win.mouse.up()
  await win.getByTestId('cover-reposition-done').click()
  await expect.poll(() => fileOf(vault, 'Görselli'), { timeout: 5000 }).toMatch(/coverPosition: 0\.\d+/)
  await app.close()
})
