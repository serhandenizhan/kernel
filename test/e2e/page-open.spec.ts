import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('ayırıcı çizgiyle başlayan sayfa açılınca çizgi seçilmez, biçim paneli açılmaz', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Gezegenler.md'), '---\nicon: "🪐"\n---\n\n---\n\nMerkür en içteki gezegendir.\n')
  writeFileSync(join(vault, 'Yıldızlar.md'), 'Güneş bir yıldızdır.\n')
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Yıldızlar' }).click()
  await win.getByTestId('tree-row').filter({ hasText: 'Gezegenler' }).click()
  await expect(win.getByTestId('editor')).toContainText('Merkür')
  await win.waitForTimeout(400)
  await expect(win.locator('.kernel-editor hr')).toHaveCount(1)
  await expect(win.locator('.ProseMirror-selectednode')).toHaveCount(0)
  await expect(win.getByTestId('bubble-toolbar')).toBeHidden()
  await app.close()
})
