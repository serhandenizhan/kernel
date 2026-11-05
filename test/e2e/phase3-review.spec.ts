import { test, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('bozuk frontmatter tarihi ana sayfayı ve uygulamayı çökertmez', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Obsidian.md'), '---\ncreated: "<% tp.file.creation_date() %>"\nupdated: "{{date}}"\n---\nNot.\n')
  const { app, win } = await launch(vault, {}, { home: true })
  await expect(win.getByTestId('home-course')).toHaveCount(1)
  await expect(win.getByTestId('sidebar')).toBeVisible()
  await app.close()
})

test('"Son açık sayfa" açılışta gerçekten son açılan sayfayı açar', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Algoritmalar.md'), 'a\n')
  writeFileSync(join(vault, 'Zooloji.md'), 'z\n')
  let { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Zooloji' }).click()
  await expect(win.getByTestId('page-title')).toHaveValue('Zooloji')
  await app.close()
  ;({ app, win } = await launch(vault))
  await expect(win.getByTestId('page-title')).toHaveValue('Zooloji')
  await app.close()
})

test('uygulama menüsünde pencere kapatma (⌘W) ve standart macOS öğeleri var', async () => {
  const { app } = await launch()
  const roles = await app.evaluate(({ Menu }) => {
    const out: string[] = []
    const walk = (items: Electron.MenuItem[]) => items.forEach((i) => (i.role && out.push(String(i.role).toLowerCase()), i.submenu && walk(i.submenu.items)))
    walk(Menu.getApplicationMenu()!.items)
    return out
  })
  for (const r of ['close', 'pasteandmatchstyle', 'services', 'unhide', 'front']) expect(roles).toContain(r)
  await app.close()
})

test('uzun başlıklı sayfa satırı alttaki bloğun üstüne taşmaz', async () => {
  const vault = tmpVault()
  const long = 'Text Classification and Sentiment Analysis with Neural Networks and Transformers Week Seven Notes'
  writeFileSync(join(vault, 'NLP.md'), `[[${long}]]\n\nSonraki paragraf\n`)
  mkdirSync(join(vault, 'NLP'))
  writeFileSync(join(vault, 'NLP', `${long}.md`), 'x\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'NLP' }).first().click()
  const row = win.locator('.page-row')
  await expect(row).toHaveCount(1)
  const [rowBox, nextBox] = await Promise.all([row.boundingBox(), win.getByText('Sonraki paragraf').boundingBox()])
  // taşan metin kutunun dışına çizilir: etiketin kendi kutusu ölçülür
  const labelBox = await row.locator('.wiki-label').boundingBox()
  expect(labelBox!.y + labelBox!.height).toBeLessThanOrEqual(nextBox!.y)
  expect(await row.locator('.wiki-label').evaluate((e) => e.scrollWidth <= e.clientWidth + 1 || getComputedStyle(e).textOverflow === 'ellipsis')).toBe(true)
  expect(rowBox!.height).toBeLessThan(60)
  await app.close()
})
