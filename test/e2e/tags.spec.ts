import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('etiketler kenar çubuğunda sayılarıyla listelenir; etikete tıklayınca sayfaları görünür; editörde vurgulanır', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Analiz.md'), '---\ntags: [vize]\n---\nLimit konusu #final\n')
  writeFileSync(join(vault, 'Cebir.md'), 'Matrisler #vize\n\n`#kod` sayılmaz\n')
  writeFileSync(join(vault, 'Fizik.md'), 'etiketsiz\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tags-toggle').click()
  const vize = win.getByTestId('tag-row').filter({ hasText: 'vize' })
  await expect(vize).toContainText('2')
  await expect(win.getByTestId('tag-row')).toHaveCount(2)
  await vize.click()
  await expect(win.getByTestId('tag-page')).toContainText('#vize')
  await expect(win.getByTestId('tag-page-row')).toHaveText([/Analiz/, /Cebir/])
  await win.getByTestId('tag-page-row').filter({ hasText: 'Cebir' }).click()
  await expect(win.getByTestId('page-title')).toHaveValue('Cebir')
  await expect(win.locator('.kernel-editor .hashtag')).toHaveText(['#vize'])
  await app.close()
})
