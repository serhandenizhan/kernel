import { test, expect } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

const bodyOf = (vault: string, file: string) => readFileSync(join(vault, file), 'utf8').replace(/^---[\s\S]*?---\n/, '')
type K = { kernel: import('../../src/shared/types').KernelApi }

test('sürüm geçmişinden eski sürüm geri yüklenir; geri yüklemeden önceki hal de saklanır; çakışma penceresi açılmaz', async () => {
  const vault = tmpVault()
  const { app, win } = await launch(vault, { KERNEL_TEST_HISTORY_INTERVAL_MS: '0' })
  await win.getByTestId('new-page').click()
  await expect(win.getByTestId('page-title')).toHaveValue('')
  await win.getByTestId('page-title').fill('Geçmiş')
  await win.getByTestId('page-title').press('Enter')
  await expect.poll(() => existsSync(join(vault, 'Geçmiş.md'))).toBe(true)
  await win.keyboard.type('birinci')
  await expect.poll(() => bodyOf(vault, 'Geçmiş.md'), { timeout: 5000 }).toBe('birinci\n')
  await win.keyboard.type(' ikinci')
  await expect.poll(() => bodyOf(vault, 'Geçmiş.md'), { timeout: 5000 }).toBe('birinci ikinci\n')
  await win.waitForTimeout(700)

  // düzenleme öncesi hal (boş sayfa) ve "birinci" sürümü geçmişte olmalı
  const pageId = await win.evaluate(async () => (await (window as unknown as K).kernel.pages.tree())[0]!.id)
  const bodies = async () =>
    win.evaluate(async (id) => {
      const k = (window as unknown as K).kernel
      const list = await k.history.list(id)
      return Promise.all(list.map(async (e) => (await k.history.read(id, e.versionId)).trim()))
    }, pageId)
  expect(await bodies()).toEqual(expect.arrayContaining(['', 'birinci']))

  await win.getByTestId('tree-row').filter({ hasText: 'Geçmiş' }).click({ button: 'right' })
  await win.getByRole('menuitem', { name: 'Sürüm geçmişi' }).click()
  const entries = win.getByTestId('history-entry')
  const index = (await bodies()).indexOf('birinci')
  await entries.nth(index).click()
  await expect(win.getByTestId('history-diff')).toContainText('birinci')
  await win.getByTestId('history-restore').click()
  await expect(win.getByTestId('history-panel')).toHaveCount(0)
  await expect(win.getByTestId('editor')).toHaveText('birinci')
  await expect.poll(() => bodyOf(vault, 'Geçmiş.md'), { timeout: 5000 }).toBe('birinci\n')
  // geri yükleme geri alınabilir: önceki hal ("birinci ikinci") geçmişte
  expect(await bodies()).toContain('birinci ikinci')
  await win.waitForTimeout(800)
  await expect(win.getByRole('dialog', { name: /Dosya dışarıda değişti/ })).toHaveCount(0)
  await app.close()
})
