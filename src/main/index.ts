import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './window'
import { installCrashLogging, log } from './log'

installCrashLogging()

app.whenReady().then(() => {
  log.info('Kernel başlatılıyor', app.getVersion())
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
