import { test, expect } from '@playwright/test'
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'
import * as B from '../fixtures/notion/builders'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
const TOKEN = 'secret_test_wizard_42'

function writeFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'kernel-nf-'))
  const file = join(dir, 'fixture.json')
  writeFileSync(
    file,
    JSON.stringify({
      workspace: 'Deneme Çalışma Alanı',
      pages: [B.page('pg-a', 'Algoritmalar', { emoji: '🧮' }), B.page('pg-s', 'Sıralama', { parent: 'pg-a' }), B.page('pg-g', 'Gezegenler')],
      blocks: {
        'pg-a': [B.para(B.t('Algoritma notları')), B.childPage('pg-s', 'Sıralama'), B.image(PNG)],
        'pg-s': [B.code('def siralama(xs):\n    return sorted(xs)', 'python')],
        'pg-g': [B.para(B.t('Mars ve Jüpiter'))]
      }
    })
  )
  return file
}

// Windows'ta çalışan uygulamanın kilitli tuttuğu dosyalar (Chromium veritabanları) okunamaz: atlanır
const readSafe = (p: string): string => {
  try {
    return readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}
const allText = (dir: string): string =>
  readdirSync(dir, { withFileTypes: true })
    .map((e) => (e.isDirectory() ? allText(join(dir, e.name)) : statSync(join(dir, e.name)).size < 2_000_000 ? readSafe(join(dir, e.name)) : ''))
    .join('\n')

test('Notion sihirbazı: bağlan, sayfa seç, aktar, rapor; token sonunda silinir ve hiçbir dosyaya yazılmaz', async () => {
  const vault = tmpVault()
  const userData = mkdtempSync(join(tmpdir(), 'kernel-ud-'))
  const { app, win } = await launch(vault, { KERNEL_TEST_NOTION_FIXTURES: writeFixture(), KERNEL_USER_DATA: userData })
  await win.getByTestId('new-menu').click()
  await win.getByTestId('notion-import').click()
  await expect(win.getByTestId('notion-wizard')).toBeVisible()
  await win.getByTestId('notion-next').click()
  await win.getByTestId('notion-token').fill(TOKEN)
  await win.getByTestId('notion-connect').click()
  await expect(win.getByTestId('notion-workspace')).toContainText('Deneme Çalışma Alanı')
  await expect(win.getByTestId('notion-page')).toHaveCount(2) // yalnızca üst seviye sayfalar listelenir
  await win.getByTestId('notion-select-all').check()
  // token hiçbir an diske yazılmaz (yalnızca bellekte)
  expect(existsSync(join(userData, 'notion-token.bin'))).toBe(false)
  await win.getByTestId('notion-start').click()
  await expect(win.getByTestId('notion-report')).toBeVisible({ timeout: 20_000 })
  await expect(win.getByTestId('notion-report')).toContainText('3 sayfa')
  await win.getByTestId('notion-finish').click()
  await expect(win.getByTestId('tree-row').filter({ hasText: 'Notion içe aktarım' })).toHaveCount(1)
  expect(existsSync(join(userData, 'notion-token.bin'))).toBe(false)
  expect(allText(vault)).not.toContain(TOKEN)
  expect(allText(userData)).not.toContain(TOKEN)
  const imported = readdirSync(vault).find((f) => f.startsWith('Notion içe aktarım') && !f.endsWith('.md'))!
  expect(readFileSync(join(vault, imported, 'Algoritmalar', 'Sıralama.md'), 'utf8')).toContain('```python')
  await app.close()
})

test('yanlış token anlaşılır hata verir', async () => {
  const { app, win } = await launch(tmpVault(), { KERNEL_TEST_NOTION_FIXTURES: writeFixture() })
  await win.getByTestId('new-menu').click()
  await win.getByTestId('notion-import').click()
  await win.getByTestId('notion-next').click()
  await win.getByTestId('notion-token').fill('yanlis')
  await win.getByTestId('notion-connect').click()
  await expect(win.getByTestId('notion-error')).toContainText('geçersiz')
  await app.close()
})

test('yarım aktarım bandı: Devam et hatası görünür; kapatıp yeniden açınca sihirbaz baştan başlar', async () => {
  const vault = tmpVault()
  const { mkdirSync } = await import('node:fs')
  mkdirSync(join(vault, '.kernel'), { recursive: true })
  writeFileSync(join(vault, '.kernel', 'notion-import.json'), JSON.stringify({ date: '2026-11-04', rootIds: ['pg-a'], rootKernelId: null, pages: {}, done: [], files: {}, report: { failedFiles: [], unsupported: [], mismatches: [], notes: [], failedPages: [] } }))
  const { app, win } = await launch(vault, { KERNEL_TEST_NOTION_FIXTURES: writeFixture() })
  await win.getByTestId('notion-resume').click()
  // token yok: hata kullanıcıya gösterilir (sessizce takılmaz)
  await expect(win.getByTestId('notion-error')).toContainText('Notion')
  await win.getByRole('button', { name: 'Kapat' }).click()
  await expect(win.getByTestId('notion-wizard')).toHaveCount(0)
  await win.getByTestId('new-menu').click()
  await win.getByTestId('notion-import').click()
  await expect(win.getByTestId('notion-next')).toBeVisible()
  await app.close()
})
