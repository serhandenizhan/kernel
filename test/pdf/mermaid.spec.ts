import { test, expect } from '@playwright/test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch, tmpVault } from '../e2e/helpers/app'
import { openPdf, pageText, renderPng } from './helpers'

test('mermaid diyagramı PDF\'e vektörel metinle basılır', async () => {
  const vault = tmpVault()
  const out = mkdtempSync(join(tmpdir(), 'kernel-pdf-'))
  writeFileSync(join(vault, 'Akış.md'), '```mermaid\ngraph LR\n  Başla --> Bitir\n```\n')
  const { app, win } = await launch(vault, { KERNEL_TEST_PDF_DIR: out })
  await win.getByTestId('tree-row').filter({ hasText: 'Akış' }).click()
  await win.keyboard.press('Meta+e')
  await win.getByTestId('pdf-export').click()
  await expect(win.getByTestId('toast').filter({ hasText: 'PDF kaydedildi' })).toBeVisible({ timeout: 30_000 })
  await app.close()
  const pdf = await openPdf(join(out, 'Akış.pdf'))
  const text = await pageText(pdf, 1)
  expect(text).toContain('Başla')
  // kod değil diyagram basılmış olmalı
  expect(text).not.toContain('-->')
  // sayfada beyaz olmayan piksel var (diyagram çizilmiş)
  const png = await renderPng(pdf, 1, 0.5)
  let dark = 0
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i]! < 200) dark++
  expect(dark).toBeGreaterThan(200)
})
