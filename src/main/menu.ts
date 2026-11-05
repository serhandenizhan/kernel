import { BrowserWindow, Menu, app } from 'electron'
import type { Lang } from '@shared/types'
import { IPC } from '@shared/ipc'
import { menuTemplate, type MenuCommand } from './menu-template'

export type { MenuCommand }

// Menü komutu arayüze gönderilir (kısayolların asıl sahibi arayüzdür; menü yalnızca gösterir ve tetikler)
const send = (cmd: MenuCommand) => () => BrowserWindow.getFocusedWindow()?.webContents.send(IPC.eventMenuCommand, cmd)

/** Seçili dilde uygulama menüsü (macOS menü çubuğu; Windows'ta pencere menüsü) */
export function buildAppMenu(lang: Lang): Menu {
  return Menu.buildFromTemplate(menuTemplate(lang, process.platform, app.isPackaged, send))
}
