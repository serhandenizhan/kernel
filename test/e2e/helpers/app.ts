import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Testler kullanıcının kasasına asla dokunmaz: her test geçici bir kasa kullanır
export function tmpVault(): string {
  return mkdtempSync(join(tmpdir(), 'kernel-vault-'))
}

export async function launch(vault = tmpVault(), extraEnv: Record<string, string> = {}): Promise<{ app: ElectronApplication; win: Page; vault: string }> {
  const app = await electron.launch({
    args: ['out/main/index.js'],
    env: { ...process.env, KERNEL_VAULT: vault, KERNEL_TEST: '1', ...extraEnv }
  })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  return { app, win, vault }
}
