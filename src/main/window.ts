import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'

const FLUSH_TIMEOUT_MS = 3000
let quitting = false
app.on('before-quit', () => {
  quitting = true
})

/** Arayüzden bekleyen kaydı yapmasını ister; en fazla 3 sn bekler. Her şey kaydedildiyse true */
function requestFlush(win: BrowserWindow): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (e: Electron.IpcMainEvent, ok: unknown) => {
      if (e.sender !== win.webContents) return
      cleanup()
      resolve(ok === true)
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve(false)
    }, FLUSH_TIMEOUT_MS)
    const cleanup = () => {
      clearTimeout(timer)
      ipcMain.removeListener(IPC.appFlushDone, done)
    }
    ipcMain.on(IPC.appFlushDone, done)
    win.webContents.send(IPC.appFlush)
  })
}

// Ana pencere: macOS trafik ışıkları kenar çubuğunun içinde, kenar çubuğu vibrancy kullanır
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Kernel',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: 'sidebar',
    visualEffectState: 'followWindow',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Kapanmadan önce açık sayfanın kaydını bekle (yazıp hemen Cmd+Q'da veri kaybı olmasın)
  let flushed = false
  win.on('close', (event) => {
    if (flushed || win.webContents.isDestroyed()) return
    event.preventDefault()
    void requestFlush(win).then(async (ok) => {
      if (!ok) {
        // kayıt başarısız: kullanıcıya sormadan değişiklikleri kaybetme (spec §14)
        const answer = await dialog.showMessageBox(win, {
          type: 'warning',
          buttons: ['Vazgeç', 'Yine de çık'],
          defaultId: 0,
          cancelId: 0,
          message: 'Kaydedilmemiş değişiklikler var',
          detail: 'Son değişiklikler diske yazılamadı. Çıkarsan kaybolabilirler.'
        })
        if (answer.response === 0) {
          quitting = false
          return
        }
      }
      flushed = true
      if (quitting) app.quit()
      else win.close()
    })
  })

  // Dış linkler varsayılan tarayıcıda açılır, pencere içi gezinme engellenir
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault()
      if (/^https?:/.test(url)) void shell.openExternal(url)
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}
