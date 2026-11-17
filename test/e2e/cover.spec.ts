import { test, expect } from '@playwright/test'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

// 1x1 PNG (sahte "görsel"): testler Unsplash'e hiç çıkmaz
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const DATA = 'data:image/png;base64,' + PNG.toString('base64')

function fixture(): { feed: string; image: string } {
  const dir = mkdtempSync(join(tmpdir(), 'kernel-unsplash-'))
  const feed = join(dir, 'search.json')
  const photo = (id: string, name: string) => ({
    id,
    alt_description: `foto ${id}`,
    urls: { raw: `https://images.unsplash.com/photo-${id}?ixid=x`, thumb: DATA },
    user: { name, links: { html: `https://unsplash.com/@${id}` } },
    links: { download_location: `https://api.unsplash.com/photos/${id}/download` }
  })
  writeFileSync(feed, JSON.stringify({ total: 2, total_pages: 1, results: [photo('a1', 'Ada Yılmaz'), photo('b2', 'Bora Kaya')] }))
  const image = join(dir, 'foto.jpg')
  writeFileSync(image, PNG)
  return { feed, image }
}

test('kapak galerisi zengin: 24+ hazır kapak', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Not.md'), 'metin\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Not' }).click()
  await win.locator('.page-header').hover()
  await win.getByTestId('add-cover').click()
  await win.locator('.page-cover').hover()
  await win.getByTestId('cover-change').click()
  expect(await win.locator('.cover-option').count()).toBeGreaterThanOrEqual(24)
  await app.close()
})

test('Unsplash: anahtarsız yönerge, anahtarla arama, seçince kapak olarak kaydedilir ve fotoğrafçı yazar', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Not.md'), 'metin\n')
  const { feed, image } = fixture()
  const { app, win } = await launch(vault, { KERNEL_TEST_UNSPLASH_FIXTURE: feed, KERNEL_TEST_UNSPLASH_IMAGE: image })
  await win.getByTestId('tree-row').filter({ hasText: 'Not' }).click()
  await win.locator('.page-header').hover()
  await win.getByTestId('add-cover').click()
  await win.locator('.page-cover').hover()
  await win.getByTestId('cover-change').click()
  await win.getByTestId('cover-tab-unsplash').click()
  // anahtar yokken yönerge ve anahtar kutusu
  await expect(win.getByTestId('unsplash-key-form')).toBeVisible()
  await win.getByTestId('unsplash-key-input').fill('test-access-key')
  await win.getByTestId('unsplash-key-save').click()
  await expect(win.getByTestId('unsplash-search')).toBeVisible()
  await win.getByTestId('unsplash-search').fill('dağ')
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('unsplash-result')).toHaveCount(2)
  await win.getByTestId('unsplash-result').first().click()
  await expect(win.getByTestId('cover-credit')).toHaveText('Ada Yılmaz · Unsplash')
  await expect(win.locator('.cover-picker')).toHaveCount(0)
  const file = readFileSync(join(vault, 'Not.md'), 'utf8')
  await expect.poll(() => readFileSync(join(vault, 'Not.md'), 'utf8')).toMatch(/cover: attachments\/.*unsplash.*\.jpg/)
  expect(readFileSync(join(vault, 'Not.md'), 'utf8')).toContain('coverCredit: Ada Yılmaz · Unsplash')
  expect(readdirSync(join(vault, 'attachments')).some((f) => f.includes('unsplash'))).toBe(true)
  void file
  // kapak değiştirilince kaynak satırı kalkar
  await win.locator('.page-cover').hover()
  await win.getByTestId('cover-change').click()
  await win.getByTestId('cover-tab-gallery').click()
  await win.locator('.cover-option').first().click()
  await expect(win.getByTestId('cover-credit')).toHaveCount(0)
  await app.close()
})

test('Unsplash: geçersiz anahtar ve arama hatası anlaşılır bir mesajla gösterilir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Not.md'), 'metin\n')
  const { app, win } = await launch(vault, { KERNEL_TEST_UNSPLASH_FIXTURE: '/yok/boyle/dosya.json' })
  await win.getByTestId('tree-row').filter({ hasText: 'Not' }).click()
  await win.locator('.page-header').hover()
  await win.getByTestId('add-cover').click()
  await win.locator('.page-cover').hover()
  await win.getByTestId('cover-change').click()
  await win.getByTestId('cover-tab-unsplash').click()
  await win.getByTestId('unsplash-key-input').fill('x')
  await win.getByTestId('unsplash-key-save').click()
  await win.getByTestId('unsplash-search').fill('dağ')
  await win.keyboard.press('Enter')
  await expect(win.getByTestId('unsplash-error')).toBeVisible()
  await app.close()
})

test('sayfa başlığı düğmeleri ikonlu ve ipuçlu; "Kaydedildi" kapağın altında kalır; menü açıkken ipucu gizlenir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Not.md'), '---\ncover: "kernel:teal-waves"\n---\nmetin burada\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Not' }).click()
  const addIcon = win.getByTestId('add-icon')
  await expect(addIcon.locator('svg.icon')).toHaveCount(1)
  await expect(addIcon).toHaveText('')
  await expect(addIcon).toHaveAttribute('data-tip', /İkon/)
  const pin = win.getByTestId('pin-toggle')
  await expect(pin).toHaveText('')
  await expect(pin).toHaveAttribute('data-tip', /Sabitle/)
  // "Kaydedildi" kapağın alt kenarına binmez
  const gap = await win.evaluate(() => {
    const s = document.querySelector('[data-testid="save-status"]')!.getBoundingClientRect()
    const c = document.querySelector('.page-cover')!.getBoundingClientRect()
    return s.top - c.bottom
  })
  expect(gap).toBeGreaterThanOrEqual(4)
  // renk menüsü açıkken vurgu düğmesinin ipucu görünmez
  await win.locator('.kernel-editor p').first().dblclick()
  await win.getByTestId('bubble-highlight').hover()
  await win.getByTestId('bubble-highlight').click()
  await expect(win.getByRole('menuitem', { name: 'Sarı' })).toBeVisible()
  const tipDisplay = await win.getByTestId('bubble-highlight').evaluate((e) => getComputedStyle(e, '::after').display)
  expect(tipDisplay).toBe('none')
  await app.close()
})
