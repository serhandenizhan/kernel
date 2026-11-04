import { test, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './helpers/app'

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
