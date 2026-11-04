import { test, expect } from '@playwright/test'
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

test('ayarlardan yedekleme açılır, klasör seçilir ve şimdi yedek alınır', async () => {
  const vault = tmpVault()
  const out = mkdtempSync(join(tmpdir(), 'kernel-bk-'))
  writeFileSync(join(vault, 'Not.md'), 'yedeklenecek\n')
  const { app, win } = await launch(vault, { KERNEL_TEST_BACKUP_DIR: out })
  await win.keyboard.press('Meta+,')
  await win.getByTestId('setting-backup').check()
  await win.getByTestId('backup-choose').click()
  await expect(win.getByTestId('backup-folder')).toHaveText(out)
  await win.getByTestId('backup-now').click()
  await expect.poll(() => readdirSync(out).filter((f) => f.endsWith('.zip')).length).toBe(1)
  await expect(win.getByTestId('backup-last')).toContainText('az önce')
  await app.close()
})

test('yedek klasörü yoksa uyarır, uygulama çalışmaya devam eder', async () => {
  const vault = tmpVault()
  const { app, win } = await launch(vault, { KERNEL_TEST_BACKUP_DIR: join(tmpdir(), 'kesinlikle-olmayan-klasor-kernel') })
  await win.keyboard.press('Meta+,')
  await win.getByTestId('setting-backup').check()
  await win.getByTestId('backup-choose').click()
  await win.getByTestId('backup-now').click()
  await expect(win.getByTestId('toast').filter({ hasText: 'Yedek alınamadı' })).toBeVisible()
  await win.keyboard.press('Escape')
  await win.getByTestId('new-page').click()
  await expect(win.getByTestId('tree-row')).toHaveCount(1)
  await app.close()
})
