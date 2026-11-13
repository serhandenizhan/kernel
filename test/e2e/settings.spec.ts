import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('içindekiler paneli başlıkları listeler ve tıklayınca kaydırır', async () => {
  const vault = tmpVault()
  const filler = Array.from({ length: 40 }, (_, i) => `Paragraf ${i}`).join('\n\n')
  writeFileSync(join(vault, 'Uzun.md'), `# Giriş\n\n${filler}\n\n## Orta\n\n${filler}\n\n### Son bölüm\n\nbitiş\n`)
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Uzun' }).click()
  await expect(win.getByTestId('editor')).toBeVisible()
  await win.keyboard.press('ControlOrMeta+Shift+t')
  const items = win.getByTestId('toc-item')
  await expect(items).toHaveCount(3)
  await expect(items.nth(2)).toHaveText('Son bölüm')
  await items.nth(2).click()
  await expect.poll(() => win.locator('.page-surface').evaluate((el) => el.scrollTop)).toBeGreaterThan(500)
  await app.close()
})

test('ayarlar: tema ve not fontu değişir, yeniden başlatınca korunur', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'A.md'), 'metin\n')
  let { app, win } = await launch(vault)
  await win.keyboard.press('ControlOrMeta+,')
  await expect(win.getByTestId('settings-dialog')).toBeVisible()
  await win.getByTestId('setting-theme-dark').click()
  await expect(win.locator('html')).toHaveAttribute('data-theme', 'dark')
  await win.getByTestId('setting-font-sans').click()
  await expect(win.locator('html')).toHaveAttribute('data-body-font', 'sans')
  await win.getByTestId('setting-strip-citations').uncheck()
  await win.keyboard.press('Escape')
  await expect(win.getByTestId('settings-dialog')).toHaveCount(0)
  await app.close()
  ;({ app, win } = await launch(vault))
  await expect(win.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(win.locator('html')).toHaveAttribute('data-body-font', 'sans')
  await win.keyboard.press('ControlOrMeta+,')
  await expect(win.getByTestId('setting-strip-citations')).not.toBeChecked()
  await app.close()
})

test('varsayılan not yazı tipi uygulamayla gelen IBM Plex Sans; ayarlardan değiştirilebilir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'A.md'), 'Çalışma ğüşiöç metni\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'A' }).first().click()
  await expect(win.locator('html')).toHaveAttribute('data-body-font', 'plex')
  const family = await win.locator('.kernel-editor p').first().evaluate((e) => getComputedStyle(e).fontFamily)
  expect(family).toContain('IBM Plex Sans')
  // yazı tipi gerçekten yüklenir (ağ yok; uygulamanın içinden)
  await expect.poll(() => win.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "IBM Plex Sans Variable"', 'ğşİ') })).toBe(true)
  await win.keyboard.press('ControlOrMeta+,')
  await expect(win.getByTestId('setting-font-plex')).toHaveAttribute('aria-checked', 'true')
  await win.getByTestId('setting-font-sans').click()
  await expect(win.locator('html')).toHaveAttribute('data-body-font', 'sans')
  await app.close()
})

test('yazı tipi paketleri başlığı, gövdeyi ve kodu birlikte değiştirir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Paket.md'), '# Büyük başlık\n\n## İkinci başlık\n\nGövde metni ve `kod` etiketi.\n\n```js\nconst x = 1\n```\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Paket' }).click()
  const font = (sel: string) => win.locator(sel).first().evaluate((e) => getComputedStyle(e).fontFamily)
  // IBM Plex paketi (varsayılan): Fraunces başlık, Plex Sans gövde, Plex Mono kod
  await expect(win.locator('html')).toHaveAttribute('data-body-font', 'plex')
  expect(await font('.page-title')).toContain('Fraunces')
  expect(await font('.kernel-editor h1')).toContain('Fraunces')
  expect(await font('.kernel-editor h2')).toContain('Fraunces')
  expect(await font('.kernel-editor p')).toContain('IBM Plex Sans')
  expect(await font('.kernel-editor p code')).toContain('IBM Plex Mono')
  expect(await font('.kernel-editor pre')).toContain('IBM Plex Mono')
  // yazı tipleri uygulamanın içinden yüklenir (Türkçe harfler dahil)
  const loads = (specs: string[]) => win.evaluate(async (list) => (await Promise.all(list.map((f) => document.fonts.load(f, 'ğşİ')))).every((r) => r.length > 0), specs)
  expect(await loads(['700 28px "Fraunces Variable"', '14px "IBM Plex Mono"'])).toBe(true)
  // Bricolage paketi: Bricolage Grotesque başlık, Figtree gövde, DM Mono kod ve küçük etiketler
  await win.keyboard.press('ControlOrMeta+,')
  await win.getByTestId('setting-font-bricolage').click()
  await win.keyboard.press('Escape')
  await expect(win.locator('html')).toHaveAttribute('data-body-font', 'bricolage')
  expect(await font('.kernel-editor h1')).toContain('Bricolage Grotesque')
  expect(await font('.kernel-editor p')).toContain('Figtree')
  expect(await font('.kernel-editor pre')).toContain('DM Mono')
  expect(await loads(['800 28px "Bricolage Grotesque Variable"', '16px "Figtree Variable"', '14px "DM Mono"'])).toBe(true)
  // sistem paketi: başlık da sistem yazısına döner
  await win.keyboard.press('ControlOrMeta+,')
  await win.getByTestId('setting-font-sans').click()
  await win.keyboard.press('Escape')
  expect(await font('.kernel-editor h1')).not.toContain('Fraunces')
  expect(await font('.kernel-editor h1')).not.toContain('Bricolage')
  await app.close()
})

test('ek yazı tipi paketleri: önizlemeli seçiciden seçilir, başlık / metin / kod yazı tipleri yüklenir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Paket.md'), '# Başlık\n\nMetin ve `kod`.\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Paket' }).click()
  const font = (sel: string) => win.locator(sel).first().evaluate((e) => getComputedStyle(e).fontFamily)
  const loads = (specs: string[]) => win.evaluate(async (list) => (await Promise.all(list.map((f) => document.fonts.load(f, 'ğşİ')))).every((r) => r.length > 0), specs)
  const packs = [
    { id: 'editorial', heading: 'Instrument Serif', body: 'Inter', mono: 'JetBrains Mono', files: ['400 28px "Instrument Serif"', '16px "Inter Variable"', '14px "JetBrains Mono Variable"'] },
    { id: 'space', heading: 'Space Grotesk', body: 'Inter', mono: 'Space Mono', files: ['700 28px "Space Grotesk Variable"', '14px "Space Mono"'] },
    { id: 'book', heading: 'Literata', body: 'Literata', mono: 'Fira Code', files: ['600 28px "Literata Variable"', '16px "Literata Variable"', '14px "Fira Code Variable"'] },
    { id: 'rounded', heading: 'Nunito', body: 'Nunito', mono: 'JetBrains Mono', files: ['800 28px "Nunito Variable"', '16px "Nunito Variable"'] }
  ]
  for (const p of packs) {
    await win.keyboard.press('ControlOrMeta+,')
    const card = win.getByTestId(`setting-font-${p.id}`)
    await card.click()
    await expect(card).toHaveAttribute('aria-checked', 'true')
    await win.keyboard.press('Escape')
    await expect(win.locator('html')).toHaveAttribute('data-body-font', p.id)
    expect(await font('.kernel-editor h1'), p.id).toContain(p.heading)
    expect(await font('.kernel-editor p'), p.id).toContain(p.body)
    expect(await font('.kernel-editor p code'), p.id).toContain(p.mono)
    expect(await loads(p.files), p.id).toBe(true)
  }
  await app.close()
})
