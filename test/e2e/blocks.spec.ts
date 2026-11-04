import { test, expect, type Page } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './helpers/app'
import { markdownToDoc } from '../../src/core/markdown/parse'

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')
const bodyOf = (vault: string, file: string) => readFileSync(join(vault, file), 'utf8').replace(/^---[\s\S]*?---\n/, '')

async function openFile(win: Page, vault: string, name: string, markdown: string) {
  writeFileSync(join(vault, `${name}.md`), markdown)
  await win.reload()
  await win.getByTestId('tree-row').filter({ hasText: name }).click()
  await expect(win.getByTestId('editor')).toBeVisible()
}

async function newPage(win: Page, vault: string, title: string) {
  await win.getByTestId('new-page').click()
  // yeni sayfanın açılmasını bekle (yoksa eski sayfanın başlığı değişir)
  await expect(win.getByTestId('page-title')).toHaveValue('')
  await win.getByTestId('page-title').fill(title)
  await win.getByTestId('page-title').press('Enter')
  await expect.poll(() => existsSync(join(vault, `${title}.md`))).toBe(true)
}

test('Markdown kısayolları blok oluşturur: kod (dil normalize), blok formül', async () => {
  const { app, win, vault } = await launch()
  await newPage(win, vault, 'Kısayol')
  await win.keyboard.type('```py ')
  await win.keyboard.type('print(1)')
  await expect(win.locator('[data-testid="code-language"]')).toHaveValue('python')
  await expect.poll(() => bodyOf(vault, 'Kısayol.md'), { timeout: 5000 }).toContain('```python\nprint(1)\n```')

  await newPage(win, vault, 'Formül kısayolu')
  await win.keyboard.type('$$ ')
  await expect(win.getByTestId('math-input')).toBeFocused()
  await win.keyboard.type('x^2')
  await win.keyboard.press('Escape')
  await expect.poll(() => bodyOf(vault, 'Formül kısayolu.md'), { timeout: 5000 }).toBe('$$\nx^2\n$$\n')
  await app.close()
})

test('tüm blok türleri açılır, düzenlenince kayıpsız kaydedilir', async () => {
  const { app, win, vault } = await launch()
  const md = [
    '## Başlık',
    '',
    '> [!tip|💡] İpucu',
    '>',
    '> callout gövdesi',
    '',
    '<details>',
    '<summary>Aç beni</summary>',
    '',
    'gizli içerik',
    '',
    '</details>',
    '',
    '```python',
    'x = 1',
    '```',
    '',
    '$$',
    '\\frac{a}{b}',
    '$$',
    '',
    'satır içi $x^2$ formül ve <mark data-color="green">yeşil</mark>',
    '',
    '| a | b |',
    '| :-- | --: |',
    '| 1 | 2 |',
    '',
    '- [x] bitti',
    '',
    'son'
  ].join('\n')
  await openFile(win, vault, 'Hepsi', md)
  await expect(win.locator('.callout')).toBeVisible()
  await expect(win.locator('.katex').first()).toBeVisible()
  await expect(win.locator('table')).toBeVisible()
  // sona bir harf ekle → kayıt tetiklenir
  await win.getByText('son', { exact: true }).click()
  await win.keyboard.press('End')
  await win.keyboard.type('!')
  await expect.poll(() => bodyOf(vault, 'Hepsi.md'), { timeout: 5000 }).toContain('son!')
  const expected = markdownToDoc(md.replace(/son$/, 'son!'))
  expect(markdownToDoc(bodyOf(vault, 'Hepsi.md'))).toEqual(expected)
  await app.close()
})

test('boşluk ve Türkçe karakterli görsel adı yüklenir', async () => {
  const { app, win, vault } = await launch()
  writeFileSync(join(vault, 'attachments', 'a b ş.png'), PNG_1x1)
  await openFile(win, vault, 'Görsel', '![resim](<attachments/a b ş.png>)\n*alt yazı*\n')
  const img = win.locator('.image-block img')
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  await expect(win.getByTestId('image-caption')).toHaveValue('alt yazı')
  await app.close()
})

test('hatalı LaTeX editörü bozmaz', async () => {
  const { app, win, vault } = await launch()
  await openFile(win, vault, 'Hatalı', 'önce\n\n$$\n\\frac{a\n$$\n\nsonra\n')
  await expect(win.getByTestId('editor')).toContainText('sonra')
  await win.getByText('sonra').click()
  await win.keyboard.press('End')
  await win.keyboard.type(' tamam')
  await expect.poll(() => bodyOf(vault, 'Hatalı.md'), { timeout: 5000 }).toContain('\\frac{a')
  await app.close()
})

test('formüle tıklayınca düzenleme alanı açılır ve geçerli LaTeX uygulanır', async () => {
  const { app, win, vault } = await launch()
  await openFile(win, vault, 'Formül', '$$\nx\n$$\n')
  await win.locator('.tiptap-mathematics-render').first().click()
  const input = win.getByTestId('math-input')
  await expect(input).toBeVisible()
  await input.fill('\\frac{1')
  await expect(win.getByTestId('math-error')).toBeVisible()
  await input.fill('\\frac{1}{2}')
  await input.press('Escape')
  await expect.poll(() => bodyOf(vault, 'Formül.md'), { timeout: 5000 }).toBe('$$\n\\frac{1}{2}\n$$\n')
  await app.close()
})
