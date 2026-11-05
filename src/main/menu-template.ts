import type { MenuItemConstructorOptions } from 'electron'
import type { Lang } from '@shared/types'
import { t } from '@shared/i18n'

export type MenuCommand = 'settings' | 'toggle-sidebar' | 'toggle-toc' | 'toggle-focus' | 'palette' | 'close-tab'

/** Seçili dilde ve platformda menü şablonu (saf; Electron'a dokunmaz) */
export function menuTemplate(lang: Lang, platform: string, packaged: boolean, send: (cmd: MenuCommand) => () => void): MenuItemConstructorOptions[] {
  const L = (k: Parameters<typeof t>[1]) => t(lang, k)
  const mac = platform === 'darwin'
  // kısayol gösterilir ama menüye kaydedilmez: tuşları arayüz yakalar. Windows'ta ⌘ yerine Ctrl
  const key = (accel: string) => (mac ? accel : accel.replace(/\bCmd\b/g, 'Ctrl'))
  const shown = (accelerator: string) => ({ accelerator: key(accelerator), registerAccelerator: false })
  const macOnly = (items: MenuItemConstructorOptions[]) => (mac ? items : [])
  return [
    {
      label: 'Kernel',
      submenu: [
        ...macOnly([{ role: 'about', label: L('menu.about') }, { type: 'separator' }]),
        { label: L('menu.settings'), ...shown('Cmd+,'), click: send('settings') },
        { type: 'separator' },
        ...macOnly([
          { role: 'hide', label: L('menu.hide') },
          { role: 'services', label: L('menu.services') },
          { type: 'separator' },
          { role: 'hideOthers', label: L('menu.hideOthers') },
          { role: 'unhide', label: L('menu.showAll') },
          { type: 'separator' }
        ]),
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
        ...macOnly([{ role: 'pasteAndMatchStyle', label: L('menu.pasteMatch') }]),
        { role: 'selectAll', label: L('menu.selectAll') }
      ]
    },
    {
      label: L('menu.view'),
      submenu: [
        { label: L('menu.sidebar'), ...shown('Cmd+\\'), click: send('toggle-sidebar') },
        { label: L('menu.toc'), ...shown('Cmd+Shift+T'), click: send('toggle-toc') },
        { label: L('menu.focus'), ...shown('Cmd+Shift+F'), click: send('toggle-focus') },
        { label: L('menu.palette'), ...shown('Cmd+P'), click: send('palette') },
        ...(packaged
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
        ...macOnly([{ role: 'zoom', label: L('menu.zoom') }]),
        { type: 'separator' },
        // Cmd+W sekmeyi kapatır (arayüz karar verir: son sekmede pencere kapanır); pencere için Cmd+Shift+W
        { label: L('menu.closeTab'), ...shown('Cmd+W'), click: send('close-tab') },
        { role: 'close', label: L('menu.close'), accelerator: key('Cmd+Shift+W') },
        ...macOnly([{ role: 'front', label: L('menu.front') }])
      ]
    }
  ]
}
