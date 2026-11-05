import { test, expect, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './helpers/app'
import { markdownToDoc } from '../../src/core/markdown/parse'
import { loadCases } from '../fixtures/paste/load'
import { ARTIFACT_HTML } from '../fixtures/paste/artifact'

const bodyOf = (vault: string, file: string) => readFileSync(join(vault, file), 'utf8').replace(/^---[\s\S]*?---\n/, '')
const cases = loadCases()
const fixture = (name: string) => cases.find((c) => c.name === name)!

async function newPage(win: Page, vault: string, title: string) {
  await win.getByTestId('new-page').click()
  await expect(win.getByTestId('page-title')).toHaveValue('')
  await win.getByTestId('page-title').fill(title)
  await win.getByTestId('page-title').press('Enter')
  await expect.poll(() => existsSync(join(vault, `${title}.md`))).toBe(true)
}

// Sistem panosuna dokunmadan sentetik yapıştırma olayı (kullanıcının panosu testlerde ezilmesin)
async function paste(win: Page, text: string, html?: string) {
  await win.evaluate(
    ({ text, html }) => {
      const dt = new DataTransfer()
      dt.setData('text/plain', text)
      if (html) dt.setData('text/html', html)
      const target = document.activeElement ?? document.querySelector('.kernel-editor')!
      target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    },
    { text, html }
  )
}

test('NotebookLM çıktısı yapıştırılınca formüller ve listeler doğru dönüşür', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Yapıştır')
  const c = fixture('notebooklm-double-escape')
  await paste(win, c.input!)
  await expect(win.locator('.kernel-editor .katex').first()).toBeVisible()
  await expect.poll(() => JSON.stringify(markdownToDoc(bodyOf(vault, 'Yapıştır.md'))), { timeout: 5000 }).toBe(JSON.stringify(markdownToDoc(c.expected)))
  await app.close()
})

test('HTML panosundaki KaTeX formülü LaTeX olarak gelir', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Html')
  const c = fixture('chatgpt-katex')
  await paste(win, c.text!, c.html)
  await expect.poll(() => JSON.stringify(markdownToDoc(bodyOf(vault, 'Html.md'))), { timeout: 5000 }).toBe(JSON.stringify(markdownToDoc(c.expected)))
  await app.close()
})

test('yapıştırma sonrası Cmd+Z ham metne döner, ikinci Cmd+Z tamamen geri alır', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Geri')
  await paste(win, 'Formül: \\\\(x^2\\\\) burada')
  await expect(win.locator('.kernel-editor .katex')).toBeVisible()
  await win.keyboard.press('ControlOrMeta+z')
  await expect(win.locator('.kernel-editor .katex')).toHaveCount(0)
  await expect(win.getByTestId('editor')).toContainText('\\\\(x^2\\\\)')
  await win.keyboard.press('ControlOrMeta+z')
  await expect(win.getByTestId('editor')).not.toContainText('Formül')
  await app.close()
})

test('Cmd+Shift+V ham metin olarak yapıştırır', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Ham')
  await win.evaluate(() => Object.defineProperty(navigator.clipboard, 'readText', { value: async () => 'a \\\\(b\\\\) c' }))
  await win.keyboard.press('ControlOrMeta+Shift+v')
  await expect(win.getByTestId('editor')).toContainText('a \\\\(b\\\\) c')
  await expect(win.locator('.kernel-editor .katex')).toHaveCount(0)
  await app.close()
})

test('kod bloğu içine yapıştırma dönüştürülmez', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Kodİçi')
  await win.keyboard.type('```python ')
  await paste(win, 'x = "$a$" # \\\\(b\\\\)')
  await expect.poll(() => bodyOf(vault, 'Kodİçi.md'), { timeout: 5000 }).toBe('```python\nx = "$a$" # \\\\(b\\\\)\n```\n')
  await app.close()
})

test('kararsız LaTeX satırı için "Formüle çevir" çipi çıkar', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Öneri')
  await paste(win, 'Kayıp \\sum_{i=1}^{n} (y_i - \\hat{y}_i)^2')
  const chip = win.getByTestId('suggest-math')
  await expect(chip).toBeVisible()
  await chip.click()
  await expect.poll(() => bodyOf(vault, 'Öneri.md'), { timeout: 5000 }).toBe('$$\nKayıp \\sum_{i=1}^{n} (y_i - \\hat{y}_i)^2\n$$\n')
  await app.close()
})

test('Claude artifact sayfası yapıştırılınca düzenlenebilir not olur (tablo, callout, terim listesi)', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Artifact')
  await paste(win, 'Gezegenler Özeti düz metin', ARTIFACT_HTML)
  await expect(win.locator('.kernel-editor table')).toHaveCount(1)
  await expect(win.locator('.kernel-editor [data-callout="warning"], .kernel-editor .callout').first()).toBeVisible()
  await expect.poll(() => bodyOf(vault, 'Artifact.md'), { timeout: 5000 }).toContain('- **Yörünge:** Bir cismin izlediği yol')
  const md = bodyOf(vault, 'Artifact.md')
  expect(md).toContain('> [!warning] Sık karışanlar')
  expect(md).toContain('| Gezegen | Uydu |')
  await app.close()
})
