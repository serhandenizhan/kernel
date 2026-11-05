import { test, expect } from '@playwright/test'
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'
import { makePng } from '../pdf/helpers'

test('tek dosyalık HTML ve Markdown zip olarak dışa aktarılır', async () => {
  const vault = tmpVault()
  const out = mkdtempSync(join(tmpdir(), 'kernel-exp-'))
  const { app, win } = await launch(vault, { KERNEL_TEST_PDF_DIR: out })
  writeFileSync(join(vault, 'attachments', 'g.png'), makePng(40, 30))
  writeFileSync(join(vault, 'Rapor.md'), 'Formül $E = mc^2$ ve görsel:\n\n![g](attachments/g.png)\n')
  await win.reload()
  await win.getByTestId('tree-row').filter({ hasText: 'Rapor' }).click()
  await expect(win.getByTestId('editor')).toBeVisible()

  await win.keyboard.press('ControlOrMeta+e')
  await win.getByTestId('export-format').selectOption('html')
  await win.getByTestId('pdf-export').click()
  await expect(win.getByTestId('toast').filter({ hasText: 'kaydedildi' })).toBeVisible({ timeout: 30_000 })
  const html = readFileSync(join(out, 'Rapor.html'), 'utf8')
  expect(html).toContain('class="katex"')
  expect(html).not.toContain('kernel-file://')
  expect(html).not.toContain('<script')
  expect(html).toMatch(/src="data:image\/png;base64,/)
  // formül fontları gömülü (internetsiz/başka bilgisayarda da doğru görünür)
  expect(html).toContain('data:font/woff2;base64,')

  await win.keyboard.press('ControlOrMeta+e')
  await win.getByTestId('export-format').selectOption('markdown')
  await win.getByTestId('pdf-export').click()
  await expect.poll(() => existsSync(join(out, 'Rapor.zip'))).toBe(true)
  expect(statSync(join(out, 'Rapor.zip')).size).toBeGreaterThan(0)
  await app.close()
})
