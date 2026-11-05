import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

type K = { kernel: import('../../src/shared/types').KernelApi }

test('sabitlenen sayfa kenar çubuğunda görünür; taşınınca kalır, çöpe atılınca düşer', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Mars.md'), '---\nicon: "🔴"\n---\nKızıl.\n')
  writeFileSync(join(vault, 'Gezegenler.md'), 'Liste.\n')
  const { app, win } = await launch(vault)
  const errors: string[] = []
  win.on('pageerror', (e) => errors.push(e.message))
  await win.getByTestId('tree-row').filter({ hasText: 'Mars' }).click({ button: 'right' })
  await win.getByRole('menuitem', { name: 'Sabitle' }).click()
  await expect(win.getByTestId('pin-row')).toHaveCount(1)
  await expect(win.getByTestId('pin-row')).toContainText('Mars')

  // sayfa başlığındaki iğne: kaldır ve yeniden sabitle
  await win.getByTestId('tree-row').filter({ hasText: 'Mars' }).click()
  await expect(win.getByTestId('pin-toggle')).toHaveAttribute('aria-pressed', 'true')
  await win.getByTestId('pin-toggle').click()
  await expect(win.getByTestId('pin-row')).toHaveCount(0)
  await win.getByTestId('pin-toggle').click()
  await expect(win.getByTestId('pin-row')).toHaveCount(1)

  // taşı: Mars, Gezegenler'in altına
  await win.evaluate(async () => {
    const k = (window as unknown as K).kernel
    const tree = await k.pages.tree()
    const mars = tree.find((n) => n.title === 'Mars')!
    const parent = tree.find((n) => n.title === 'Gezegenler')!
    await k.pages.move(mars.id, parent.id, 0)
  })
  await win.getByTestId('tree-row').filter({ hasText: 'Gezegenler' }).click()
  await expect(win.getByTestId('pin-row')).toContainText('Mars')

  // çöpe at → düşer
  await win.getByTestId('pin-row').click()
  await win.evaluate(async () => {
    const k = (window as unknown as K).kernel
    const find = (ns: import('../../src/shared/types').TreeNode[]): string | undefined => ns.flatMap((n) => (n.title === 'Mars' ? [n.id] : [find(n.children)].filter(Boolean) as string[]))[0]
    await k.pages.trash(find(await k.pages.tree())!)
  })
  await expect(win.getByTestId('pin-row')).toHaveCount(0, { timeout: 5000 })
  expect(errors).toEqual([])
  await app.close()
})
