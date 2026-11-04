import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './helpers/app'

const row = (win: import('@playwright/test').Page, title: string) => win.getByTestId('tree-row').filter({ hasText: title })

test('kenar çubuğundan sayfa oluşturma, adlandırma, alt sayfa ve taşıma', async () => {
  const { app, win, vault } = await launch()
  await expect(win.getByTestId('vault-picker')).toHaveCount(0)

  await win.getByTestId('new-page').click()
  await expect(row(win, 'Adsız')).toHaveCount(1)

  // çift tıkla yeniden adlandır
  await row(win, 'Adsız').dblclick()
  const input = win.getByTestId('rename-input')
  await input.fill('Fizik')
  await input.press('Enter')
  await expect(row(win, 'Fizik')).toHaveCount(1)
  await expect.poll(() => existsSync(join(vault, 'Fizik.md'))).toBe(true)

  // alt sayfa
  await row(win, 'Fizik').hover()
  await row(win, 'Fizik').getByTestId('add-child').click()
  await expect.poll(() => existsSync(join(vault, 'Fizik', 'Adsız.md'))).toBe(true)

  // sağ tık menüsüyle yeniden adlandır
  await win.getByTestId('new-page').click()
  const fresh = row(win, 'Adsız').last()
  await fresh.click({ button: 'right' })
  await win.getByRole('menuitem', { name: 'Yeniden adlandır' }).click()
  await win.getByTestId('rename-input').fill('Kimya')
  await win.getByTestId('rename-input').press('Enter')
  await expect(row(win, 'Kimya')).toHaveCount(1)

  // sürükle-bırak: Kimya → Fizik'in altına
  await row(win, 'Kimya').dragTo(row(win, 'Fizik'))
  await expect.poll(() => existsSync(join(vault, 'Fizik', 'Kimya.md'))).toBe(true)

  await app.close()
})

test('Cmd+\\ kenar çubuğunu gizler, Cmd+N yeni sayfa açar', async () => {
  const { app, win } = await launch()
  await expect(win.getByTestId('sidebar')).toBeVisible()
  await win.keyboard.press('Meta+Backslash')
  await expect(win.getByTestId('sidebar')).toBeHidden()
  await win.keyboard.press('Meta+Backslash')
  await win.keyboard.press('Meta+n')
  await expect(row(win, 'Adsız')).toHaveCount(1)
  await app.close()
})

test('kasa yoksa kasa seçme ekranı görünür', async () => {
  const { app, win } = await launch('', { KERNEL_VAULT: '' })
  await expect(win.getByTestId('vault-picker')).toBeVisible()
  await expect(win.getByText('Kernel kasası oluştur')).toBeVisible()
  await app.close()
})
