import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { keyLabel } from '../../../src/core/keys'

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
  if (vault) {
    mkdirSync(join(vault, '.kernel'), { recursive: true })
    // testler makinenin sistem dilinden bağımsız olarak Türkçe çalışır
    const base = !opts.onboarding ? { tourDone: true, tips: { enabled: false, seen: [] } } : opts.skipTour ? { tourDone: true } : {}
    const settings = { ...base, schema: 2, language: 'tr', ...(opts.home ? {} : { startView: 'last' }) }
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

// Platforma göre tuş ve etiketler (testler macOS ve Windows'ta çalışır)
export const isMacOS = process.platform === 'darwin'
/** Arayüzde gösterilen kısayol etiketi: Mac'te ⌘⇧F, Windows'ta Ctrl+Shift+F */
export const keyText = (label: string): string => keyLabel(label, isMacOS)
/** İmlecin solundaki kelimeyi seçen tuş */
export const SELECT_WORD_LEFT = isMacOS ? 'Shift+Alt+ArrowLeft' : 'Shift+Control+ArrowLeft'

/** İmleci belgenin sonuna taşır ve yeni satır açar (klavye kısayolu platforma göre değişmesin) */
export async function newLineAtEnd(win: Page): Promise<void> {
  await win.evaluate(() => (document.querySelector('.ProseMirror') as unknown as { editor: { commands: { focus(p: string): void } } }).editor.commands.focus('end'))
  // TipTap odağı bir sonraki karede verir: editör gerçekten odaklanınca devam
  await win.waitForFunction(() => document.activeElement?.classList.contains('ProseMirror') === true)
  await win.keyboard.press('Enter')
}
