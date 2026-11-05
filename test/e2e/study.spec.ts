import { test, expect } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('kartlar desteden çalışılır; değerlendirme srs.json’a yazılır; ana sayfada bugünün tekrarı görünür', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Cebir.md'), 'Özdeğer nedir? :: Av = λv sağlayan λ\nRank nedir? :: Bağımsız satır sayısı\n')
  writeFileSync(join(vault, 'Fizik.md'), '<details data-card>\n<summary>Newton 2</summary>\n\nF = ma\n\n</details>\n')
  const { app, win } = await launch(vault, {}, { home: true })
  await expect(win.getByTestId('home-review')).toContainText('3')
  // "Başla" doğrudan tüm vadesi gelenlerle oturumu açar; Esc deste listesine döner
  await win.getByTestId('home-review-start').click()
  await expect(win.getByTestId('study-progress')).toHaveText('1 / 3')
  await win.keyboard.press('Escape')
  await expect(win.getByTestId('study-page')).toBeVisible()
  await expect(win.getByTestId('deck-row').first()).toContainText('Tüm kartlar')
  await win.getByTestId('deck-row').filter({ hasText: 'Cebir' }).getByTestId('deck-study').click()
  await expect(win.getByTestId('card-question')).toHaveText('Özdeğer nedir?')
  await expect(win.getByTestId('card-answer')).toHaveCount(0)
  await win.keyboard.press('Space')
  await expect(win.getByTestId('card-answer')).toContainText('Av = λv')
  await win.getByTestId('rate-good').click()
  await expect(win.getByTestId('card-question')).toHaveText('Rank nedir?')
  await win.keyboard.press('Space')
  await win.keyboard.press('4') // Kolay
  await expect(win.getByTestId('study-done')).toBeVisible()
  await expect.poll(() => existsSync(join(vault, '.kernel', 'srs.json'))).toBe(true)
  const srs = JSON.parse(readFileSync(join(vault, '.kernel', 'srs.json'), 'utf8'))
  expect(Object.keys(srs.cards)).toHaveLength(2)

  // vadesi gelenler azaldı; sınav modu yine tüm kartları sorar
  await win.getByTestId('study-back').click()
  await expect(win.getByTestId('deck-row').filter({ hasText: 'Cebir' })).toContainText('0')
  await win.getByTestId('deck-row').filter({ hasText: 'Cebir' }).getByTestId('deck-exam').click()
  await expect(win.getByTestId('study-progress')).toHaveText('1 / 2')
  await app.close()
})

test('çalışırken arama paletinde boşluk yazılabilir ve rakamlar kartı değerlendirmez; basılı tutulan tuş kart atlatmaz', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Kart.md'), 'S1 :: C1\nS2 :: C2\nS3 :: C3\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('nav-study').click()
  await win.getByTestId('deck-row').first().getByTestId('deck-study').click()
  await expect(win.getByTestId('card-question')).toHaveText('S1')
  await win.keyboard.press('Space')
  await expect(win.getByTestId('card-answer')).toBeVisible()
  await win.keyboard.press('ControlOrMeta+k')
  await win.getByTestId('search-input').pressSequentially('a b 3')
  await expect(win.getByTestId('search-input')).toHaveValue('a b 3')
  await win.keyboard.press('Escape')
  await expect(win.getByTestId('study-progress')).toHaveText('1 / 3')
  // aynı karta iki hızlı değerlendirme yalnızca bir kart ilerletir
  await win.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }))
  })
  await expect(win.getByTestId('study-progress')).toHaveText('2 / 3')
  await app.close()
})
