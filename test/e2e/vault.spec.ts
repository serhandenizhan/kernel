import { test, expect } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

type K = { kernel: import('../../src/shared/types').KernelApi }

test('window.kernel ile sayfa oluşturulur ve diske yazılır', async () => {
  const { app, win, vault } = await launch()
  const info = await win.evaluate(() => (window as unknown as K).kernel.vault.info())
  expect(info?.path).toBe(vault)
  await win.evaluate(() => (window as unknown as K).kernel.pages.create(null, 'Fizik'))
  const tree = await win.evaluate(() => (window as unknown as K).kernel.pages.tree())
  expect(tree.map((n) => n.title)).toEqual(['Fizik'])
  expect(existsSync(join(vault, 'Fizik.md'))).toBe(true)
  await app.close()
})

test('5.7: kasa değiştirirken bekleyen kayıt yazılır ve eski kasa sekmeleri sıfırlanır', async () => {
  const vaultA = tmpVault()
  const vaultB = tmpVault()
  writeFileSync(join(vaultA, 'NotA1.md'), 'birinci\n')
  writeFileSync(join(vaultA, 'NotA2.md'), 'ikinci\n')
  mkdirSync(join(vaultB, '.kernel'), { recursive: true })
  writeFileSync(join(vaultB, '.kernel', 'settings.json'), JSON.stringify({ schema: 3, language: 'tr', startView: 'last', tourDone: true, tips: { enabled: false, seen: [] } }))
  writeFileSync(join(vaultB, 'NotB.md'), '---\nid: pg-vault-b\n---\n\nyeni kasa icerigi\n')

  const { app, win } = await launch(vaultA)
  try {
    await app.evaluate(({ dialog }, nextVault) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [nextVault] })
    }, vaultB)

    await win.getByTestId('tree-row').filter({ hasText: 'NotA1' }).click()
    await win.getByTestId('tree-row').filter({ hasText: 'NotA2' }).click({ modifiers: ['ControlOrMeta'] })
    await expect(win.getByTestId('tab')).toHaveCount(2)
    await expect(win.getByTestId('page-title')).toHaveValue('NotA2')

    await win.getByTestId('editor').click()
    await win.keyboard.press('End')
    await win.keyboard.type(' kaydedilmeli')
    // 500ms otomatik kayıt dolmadan hemen kasa değiştir
    await win.keyboard.press('ControlOrMeta+,')
    await expect(win.getByTestId('settings-dialog')).toBeVisible()
    await win.getByRole('button', { name: 'Başka bir kasa seç' }).click()

    await expect(win.getByTestId('settings-dialog')).toHaveCount(0)
    await expect(win.getByTestId('page-title')).toHaveValue('NotB', { timeout: 5000 })
    expect(readFileSync(join(vaultA, 'NotA2.md'), 'utf8')).toContain('kaydedilmeli')
    await expect(win.getByTestId('tab')).toHaveCount(0)
    await expect(win.getByTestId('tree-row').filter({ hasText: 'NotA1' })).toHaveCount(0)
  } finally {
    await app.close()
  }
})
