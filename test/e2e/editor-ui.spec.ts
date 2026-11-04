import { test, expect, type Page } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './helpers/app'

const bodyOf = (vault: string, file: string) => readFileSync(join(vault, file), 'utf8').replace(/^---[\s\S]*?---\n/, '')

async function newPage(win: Page, vault: string, title: string) {
  await win.getByTestId('new-page').click()
  await expect(win.getByTestId('page-title')).toHaveValue('')
  await win.getByTestId('page-title').fill(title)
  await win.getByTestId('page-title').press('Enter')
  await expect.poll(() => existsSync(join(vault, `${title}.md`))).toBe(true)
}

test('/ menüsü Türkçe karaktersiz aramayla blok ekler', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Slash')
  await win.keyboard.type('/basl')
  await expect(win.getByTestId('slash-menu')).toBeVisible()
  await expect(win.getByTestId('slash-item').first()).toContainText('Başlık 1')
  await win.keyboard.press('ArrowDown')
  await win.keyboard.press('Enter')
  await win.keyboard.type('Konu')
  await expect.poll(() => bodyOf(vault, 'Slash.md'), { timeout: 5000 }).toBe('## Konu\n')
  await win.keyboard.press('Enter')
  await win.keyboard.type('/tablo')
  await win.keyboard.press('Enter')
  await expect(win.locator('.kernel-editor table')).toBeVisible()
  await app.close()
})

test('metin seçince biçim araç çubuğu çıkar ve kalın uygular', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Bubble')
  await win.keyboard.type('önemli kelime')
  await win.keyboard.press('Shift+Alt+ArrowLeft')
  await expect(win.getByTestId('bubble-toolbar')).toBeVisible()
  await win.getByTestId('bubble-bold').click()
  await expect.poll(() => bodyOf(vault, 'Bubble.md'), { timeout: 5000 }).toBe('önemli **kelime**\n')
  await win.getByTestId('bubble-highlight').click()
  await win.getByRole('menuitem', { name: 'Sarı' }).click()
  await expect.poll(() => bodyOf(vault, 'Bubble.md'), { timeout: 5000 }).toContain('<mark data-color="yellow">')
  await app.close()
})

test('blok tutamağıyla sürükleyerek sıralama değişir, menüden çoğaltılır', async () => {
  const { app, win, vault } = await launch()
  writeFileSync(join(vault, 'Sıra.md'), 'bir\n\niki\n')
  await win.reload()
  await win.getByTestId('tree-row').filter({ hasText: 'Sıra' }).click()
  const iki = win.locator('.kernel-editor p', { hasText: 'iki' })
  const bir = win.locator('.kernel-editor p', { hasText: 'bir' })
  await iki.hover()
  const handle = win.getByTestId('block-handle')
  await expect(handle).toBeVisible()
  await handle.dragTo(bir, { targetPosition: { x: 10, y: 2 } })
  await expect.poll(() => bodyOf(vault, 'Sıra.md'), { timeout: 5000 }).toBe('iki\n\nbir\n')

  await win.locator('.kernel-editor p', { hasText: 'bir' }).hover()
  await win.getByTestId('block-handle').click()
  await win.getByRole('menuitem', { name: 'Çoğalt' }).click()
  await expect.poll(() => bodyOf(vault, 'Sıra.md'), { timeout: 5000 }).toBe('iki\n\nbir\n\nbir\n')
  await app.close()
})
