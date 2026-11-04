import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { installCrashLogging, log } from './log'
import { handleVaultProtocol, registerVaultScheme } from './protocol-handler'
import { openVault, registerIpc } from './ipc-handlers'
import { resolveVaultPath } from './config'

installCrashLogging()
registerVaultScheme()

app.whenReady().then(async () => {
  log.info('Kernel başlatılıyor', app.getVersion())
  handleVaultProtocol()
  registerIpc()
  const vaultPath = await resolveVaultPath()
  if (vaultPath) {
    try {
      await openVault(vaultPath)
    } catch (e) {
      log.error('Kasa açılamadı', vaultPath, e)
    }
  }
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
