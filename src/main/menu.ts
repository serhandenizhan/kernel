import { BrowserWindow, Menu, app, type MenuItemConstructorOptions } from 'electron'
import type { Lang } from '@shared/types'
import { t } from '@shared/i18n'
import { IPC } from '@shared/ipc'

export type MenuCommand = 'settings' | 'toggle-sidebar' | 'toggle-toc'

// Menü komutu arayüze gönderilir (kısayolların asıl sahibi arayüzdür; menü yalnızca gösterir ve tetikler)
const send = (cmd: MenuCommand) => () => BrowserWindow.getFocusedWindow()?.webContents.send(IPC.eventMenuCommand, cmd)

/** Seçili dilde uygulama menüsü (macOS menü çubuğu) */
export function buildAppMenu(lang: Lang): Menu {
  const L = (k: Parameters<typeof t>[1]) => t(lang, k)
  // kısayol gösterilir ama menüye kaydedilmez: tuşları arayüz yakalar
  const shown = (accelerator: string) => ({ accelerator, registerAccelerator: false })
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: L('menu.about') },
        { type: 'separator' },
        { label: L('menu.settings'), ...shown('Cmd+,'), click: send('settings') },
        { type: 'separator' },
        { role: 'hide', label: L('menu.hide') },
        { role: 'hideOthers', label: L('menu.hideOthers') },
        { type: 'separator' },
        { role: 'quit', label: L('menu.quit') }
      ]
    },
    {
      label: L('menu.edit'),
      submenu: [
        { role: 'undo', label: L('menu.undo') },
        { role: 'redo', label: L('menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: L('menu.cut') },
        { role: 'copy', label: L('menu.copy') },
        { role: 'paste', label: L('menu.paste') },
        { role: 'selectAll', label: L('menu.selectAll') }
      ]
    },
    {
      label: L('menu.view'),
      submenu: [
        { label: L('menu.sidebar'), ...shown('Cmd+\\'), click: send('toggle-sidebar') },
        { label: L('menu.toc'), ...shown('Cmd+Shift+T'), click: send('toggle-toc') },
        ...(app.isPackaged
          ? []
          : ([{ type: 'separator' }, { role: 'reload', label: L('menu.reload') }, { role: 'toggleDevTools', label: L('menu.devtools') }] as MenuItemConstructorOptions[])),
        { type: 'separator' },
        { role: 'togglefullscreen', label: L('menu.fullscreen') }
      ]
    },
    {
      label: L('menu.window'),
      submenu: [
        { role: 'minimize', label: L('menu.minimize') },
        { role: 'zoom', label: L('menu.zoom') }
      ]
    }
  ]
  return Menu.buildFromTemplate(template)
}
