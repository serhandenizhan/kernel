import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } from 'electron'
import { isHeadlessTest, windowOptions } from './window-options'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import { mainT } from './i18n'

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

// Ana pencere: görünüm platforma göre (window-options.ts)
export function createMainWindow(): BrowserWindow {
  const headless = isHeadlessTest(process.env)
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Kernel',
    ...windowOptions(process.platform, nativeTheme.shouldUseDarkColors),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // gizli test penceresi de tam hızda çizilsin
      backgroundThrottling: !headless
    }
  })

  if (!headless) win.once('ready-to-show', () => win.show())
  else
    win.once('ready-to-show', () => {
      // gizli pencere bazı makinelerde (CI) hiç çizilmez; çizilmeyen sayfada End/Home gibi tuşlar çalışmaz.
      // Bu yüzden pencere görünmez (opaklık 0), tıklamaları geçirir ve odak almadan açılır: kullanıcı hiçbir şey görmez.
      win.setOpacity(0)
      win.setIgnoreMouseEvents(true)
      win.setSkipTaskbar(true)
      win.showInactive()
    })

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
          buttons: [mainT('quit.cancel'), mainT('quit.anyway')],
          defaultId: 0,
          cancelId: 0,
          message: mainT('quit.message'),
          detail: mainT('quit.detail')
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
