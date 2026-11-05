import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { installCrashLogging, log } from './log'
import { handleVaultProtocol, registerVaultScheme } from './protocol-handler'
import { openVault, registerIpc } from './ipc-handlers'
import { resolveVaultPath } from './config'
import { Menu } from 'electron'
import { buildAppMenu } from './menu'
import { removeLegacyTokenFile } from './secrets'
import { mainLang, onMainLanguageChange } from './i18n'

// Testlerde uygulama ayarları geçici klasörde tutulur
if (process.env['KERNEL_USER_DATA']) app.setPath('userData', process.env['KERNEL_USER_DATA'])

installCrashLogging()
registerVaultScheme()
// Chromium'un kendi şifreleme anahtarı için Anahtar Zinciri'ne gitmesin (Kernel gizli bilgi saklamaz; parola penceresi açılmaz)
app.commandLine.appendSwitch('use-mock-keychain')

app.whenReady().then(async () => {
  log.info('Kernel başlatılıyor', app.getVersion())
  handleVaultProtocol()
  void removeLegacyTokenFile(app.getPath('userData')).catch(() => undefined)
  registerIpc()
  const vaultPath = await resolveVaultPath()
  if (vaultPath) {
    try {
      await openVault(vaultPath)
    } catch (e) {
      log.error('Kasa açılamadı', vaultPath, e)
    }
  }
  // menü seçili dilde kurulur ve dil değişince yeniden kurulur
  Menu.setApplicationMenu(buildAppMenu(mainLang()))
  onMainLanguageChange((lang) => Menu.setApplicationMenu(buildAppMenu(lang)))
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
