import { describe, expect, it } from 'vitest'
import { windowOptions } from '../../../src/main/window-options'
import { menuTemplate } from '../../../src/main/menu-template'

const roles = (items: Electron.MenuItemConstructorOptions[]): string[] =>
  items.flatMap((i) => [...(i.role ? [i.role as string] : []), ...(Array.isArray(i.submenu) ? roles(i.submenu) : [])])
const accels = (items: Electron.MenuItemConstructorOptions[]): string[] =>
  items.flatMap((i) => [...(i.accelerator ? [String(i.accelerator)] : []), ...(Array.isArray(i.submenu) ? accels(i.submenu) : [])])

describe('windowOptions', () => {
  it('uses the inset title bar and vibrancy on macOS', () => {
    expect(windowOptions('darwin', false)).toMatchObject({ titleBarStyle: 'hiddenInset', vibrancy: 'sidebar' })
  })
  it('uses a normal frame with an opaque background on Windows', () => {
    const o = windowOptions('win32', true)
    expect(o.titleBarStyle).toBeUndefined()
    expect(o.vibrancy).toBeUndefined()
    expect(o.autoHideMenuBar).toBe(true)
    expect(o.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i)
    expect(windowOptions('win32', false).backgroundColor).not.toBe(o.backgroundColor)
  })
})

describe('menuTemplate', () => {
  const send = () => () => undefined
  it('keeps the macOS app menu on a Mac', () => {
    expect(roles(menuTemplate('tr', 'darwin', true, send))).toEqual(expect.arrayContaining(['services', 'hideOthers', 'front']))
  })
  it('drops macOS-only roles and uses Ctrl shortcuts on Windows', () => {
    const tpl = menuTemplate('tr', 'win32', true, send)
    expect(roles(tpl)).not.toEqual(expect.arrayContaining(['services']))
    for (const r of ['hide', 'hideOthers', 'unhide', 'front', 'zoom', 'pasteAndMatchStyle']) expect(roles(tpl)).not.toContain(r)
    expect(roles(tpl)).toContain('quit')
    expect(accels(tpl).every((a) => !/\bCmd\b/.test(a))).toBe(true)
    expect(accels(tpl)).toContain('Ctrl+W')
  })
})
