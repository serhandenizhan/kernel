import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

const body = (vault: string) => readFileSync(join(vault, 'Kod.md'), 'utf8')

test('dil seçici: aranan metin kendiliğinden seçilmez, klavyeyle ve tıklayarak seçilir, mermaid listede', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Kod.md'), '```python\nprint("Mars")\n```\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Kod' }).click()
  const button = win.getByTestId('code-language')
  await expect(button).toHaveText(/Python/)

  // yazarken dil değişmez; arama kutusu yazılanı korur
  await button.click()
  const search = win.getByTestId('code-language-search')
  await expect(search).toBeFocused()
  await search.pressSequentially('mer')
  await expect(search).toHaveValue('mer')
  await expect(button).toHaveText(/Python/)
  await expect(win.getByTestId('code-language-option')).toHaveText([/Mermaid/])
  await search.press('Enter')
  await expect(win.getByTestId('code-language-search')).toHaveCount(0)
  await expect(button).toHaveText(/Mermaid/)
  await expect.poll(() => body(vault), { timeout: 5000 }).toContain('```mermaid\n')

  // Esc değişiklik yapmadan kapatır
  await button.click()
  await win.getByTestId('code-language-search').pressSequentially('rust')
  await win.keyboard.press('Escape')
  await expect(win.getByTestId('code-language-search')).toHaveCount(0)
  await expect(button).toHaveText(/Mermaid/)

  // ok tuşlarıyla gezinme ve tıklayarak "Düz metin"
  await button.click()
  await win.getByTestId('code-language-search').pressSequentially('java')
  await expect(win.getByTestId('code-language-option')).toHaveText([/Java$/, /JavaScript/])
  await win.keyboard.press('ArrowDown')
  await win.keyboard.press('Enter')
  await expect(button).toHaveText(/JavaScript/)
  await button.click()
  await win.getByTestId('code-language-option').filter({ hasText: 'Düz metin' }).click()
  await expect(button).toHaveText(/Düz metin/)
  await expect.poll(() => body(vault), { timeout: 5000 }).toMatch(/^```\nprint/m)
  await app.close()
})
