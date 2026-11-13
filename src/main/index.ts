import { isHeadlessTest } from './window-options'
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
import { pendingCount, waitPending } from './pending'

// Testlerde uygulama ayarları geçici klasörde tutulur
if (process.env['KERNEL_USER_DATA']) app.setPath('userData', process.env['KERNEL_USER_DATA'])

installCrashLogging()
registerVaultScheme()
// Chromium'un kendi şifreleme anahtarı için Anahtar Zinciri'ne gitmesin (Kernel gizli bilgi saklamaz; parola penceresi açılmaz)
if (process.platform === 'darwin') app.commandLine.appendSwitch('use-mock-keychain')

// testlerde görünmez pencere "örtülü" sayılıp çizimi yavaşlatılmasın (macOS / Windows)
if (isHeadlessTest(process.env)) {
  app.commandLine.appendSwitch('disable-renderer-backgrounding')
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
}

app.whenReady().then(async () => {
  // testlerde Dock simgesi de çıkmaz (odak ve dikkat çalınmaz)
  if (isHeadlessTest(process.env)) app.dock?.hide()
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

// kapanmadan önce süren yazımlar (ayar, son sayfa, kart vb.) en çok 3 sn beklenir
let drained = false
app.on('will-quit', (event) => {
  if (drained || pendingCount() === 0) return
  event.preventDefault()
  void waitPending(3000).then(() => {
    drained = true
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
