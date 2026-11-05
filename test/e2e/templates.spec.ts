import { test, expect } from '@playwright/test'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('şablondan yeni sayfa oluşturulur, sayfa şablon olarak kaydedilir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Laboratuvar.md'), '## Amaç\n\n## Gözlem\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('new-menu').click()
  await win.getByTestId('new-from-template').click()
  await win.getByRole('menuitem', { name: 'Ders notu' }).click()
  await expect(win.getByTestId('page-title')).toHaveValue(/^Ders notu \d{2}\.\d{2}\.\d{4}$/)
  await expect(win.getByTestId('editor')).toContainText('Önemli kavramlar')
  await expect.poll(() => readdirSync(vault).some((f) => /^Ders notu \d{2}\.\d{2}\.\d{4}\.md$/.test(f))).toBe(true)

  await win.getByTestId('tree-row').filter({ hasText: 'Laboratuvar' }).click({ button: 'right' })
  await win.getByRole('menuitem', { name: 'Şablon olarak kaydet' }).click()
  await expect.poll(() => readdirSync(join(vault, '.kernel', 'templates'))).toContain('Laboratuvar.md')
  expect(readFileSync(join(vault, '.kernel', 'templates', 'Laboratuvar.md'), 'utf8')).toContain('## Gözlem')
  await win.getByTestId('new-menu').click()
  await win.getByTestId('new-from-template').click()
  await expect(win.getByRole('menuitem', { name: 'Laboratuvar' })).toBeVisible()
  await app.close()
})
