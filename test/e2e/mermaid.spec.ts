import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('mermaid kod bloğu diyagram olarak görünür, kod görünümüne geçilir, hata gösterilir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Diyagram.md'), '```mermaid\ngraph TD\n  Başla --> Bitir\n```\n\n```mermaid\ngraph TD\n  A -->\n```\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Diyagram' }).click()
  const preview = win.locator('.mermaid-preview').first()
  await expect(preview.locator('svg')).toBeVisible({ timeout: 15_000 })
  await expect(preview).toContainText('Başla')
  await expect(win.locator('.mermaid-error')).toHaveCount(1)
  await win.getByTestId('mermaid-toggle').first().click()
  await expect(win.locator('.code-block').first().locator('code')).toBeVisible()
  await app.close()
})

test('"mermaid" etiketli ama diyagram olmayan düz metin ağaç hata vermez, kod olarak görünür', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Ağaç.md'), '```mermaid\nGezegenler\n│\n├── Kayalık\n│   └── Mars\n└── Gaz devleri\n```\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Ağaç' }).click()
  await expect(win.locator('.kernel-editor pre')).toBeVisible()
  await expect(win.locator('.kernel-editor pre')).toContainText('├── Kayalık')
  await win.waitForTimeout(600)
  await expect(win.locator('.mermaid-error')).toHaveCount(0)
  await app.close()
})
