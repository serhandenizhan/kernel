import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('geri bağlantılar bağlam cümlesiyle listelenir; hedef yeniden adlandırılınca kasadaki linkler güncellenir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Matris.md'), 'matris sayfası\n')
  writeFileSync(join(vault, 'Ders.md'), 'Giriş.\n\nBugün [[Matris|matrisleri]] işledik.\n')
  writeFileSync(join(vault, 'Yalnız.md'), 'link yok\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Yalnız' }).click()
  await expect(win.getByTestId('editor')).toContainText('link yok')
  await expect(win.getByTestId('backlinks')).toHaveCount(0)

  await win.getByTestId('tree-row').filter({ hasText: 'Matris' }).click()
  await expect(win.getByTestId('backlink')).toHaveCount(1)
  await expect(win.getByTestId('backlink')).toContainText('Bugün matrisleri işledik.')

  await win.getByTestId('page-title').fill('Matrisler')
  await win.getByTestId('page-title').press('Enter')
  await expect.poll(() => readFileSync(join(vault, 'Ders.md'), 'utf8'), { timeout: 5000 }).toContain('[[Matrisler|matrisleri]]')
  await expect(win.getByTestId('backlink')).toHaveCount(1)

  await win.getByTestId('backlink').click()
  await expect(win.getByTestId('page-title')).toHaveValue('Ders')
  await app.close()
})
