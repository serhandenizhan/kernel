import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Testler kullanıcının kasasına asla dokunmaz: her test geçici bir kasa kullanır
export function tmpVault(): string {
  return mkdtempSync(join(tmpdir(), 'kernel-vault-'))
}

export interface LaunchOptions {
  /** true: tanıtım turu ve ipuçları açık kalır (varsayılan: kapalı, diğer testlerin tıklamalarını engellemesin) */
  onboarding?: boolean
  /** onboarding açıkken yalnızca turu atla (ipuçları açık) */
  skipTour?: boolean
  /** true: uygulama ana sayfayla açılır (varsayılan: son sayfa, mevcut testler değişmesin) */
  home?: boolean
}

export async function launch(vault = tmpVault(), extraEnv: Record<string, string> = {}, opts: LaunchOptions = {}): Promise<{ app: ElectronApplication; win: Page; vault: string }> {
  if (vault && (!opts.onboarding || opts.skipTour || opts.home)) {
    mkdirSync(join(vault, '.kernel'), { recursive: true })
    const base = opts.onboarding ? { tourDone: true } : { tourDone: true, tips: { enabled: false, seen: [] } }
    const settings = { ...base, schema: 2, ...(opts.home ? {} : { startView: 'last' }) }
    try {
      writeFileSync(join(vault, '.kernel', 'settings.json'), JSON.stringify(settings), { flag: 'wx' })
    } catch {
      // ayar dosyası zaten var (ikinci açılış): dokunma
    }
  }
  const app = await electron.launch({
    args: ['out/main/index.js'],
    // userData da geçici: testler gerçek uygulama ayarlarını görmez/değiştirmez
    env: { ...process.env, KERNEL_VAULT: vault, KERNEL_TEST: '1', KERNEL_USER_DATA: mkdtempSync(join(tmpdir(), 'kernel-ud-')), ...extraEnv }
  })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  return { app, win, vault }
}
