import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir } from 'node:fs/promises'
import { extname } from 'node:path'
import { IPC } from '@shared/ipc'
import type { PageMeta, PdfOptions, Settings } from '@shared/types'
import { Vault } from './vault/vault'
import { watchVault } from './vault/watcher'
import { readSettings, writeSettings } from './vault/settings'
import { defaultVaultPath, saveVaultPath } from './config'
import { requireVault, state } from './state'
import { log } from './log'

function broadcast(channel: string, ...args: unknown[]): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, ...args)
}

export async function openVault(path: string): Promise<void> {
  await state.stopWatcher?.()
  await mkdir(path, { recursive: true })
  const vault = new Vault(path)
  await vault.init()
  state.vault = vault
  state.stopWatcher = await watchVault(vault, (e) => {
    if (e.type === 'tree-changed') broadcast(IPC.eventTreeChanged)
    else broadcast(IPC.eventPageChanged, e.id)
  })
  log.info('Kasa açıldı', path)
}

// Ek servisler (arama, PDF) sonraki görevlerde buraya kanca atar
export const hooks = {
  afterWrite: async (_id: string) => {},
  search: async (_q: string, _limit?: number) => [] as unknown[],
  recent: async () => [] as unknown[],
  pdf: async (_id: string, _o: PdfOptions): Promise<{ filePath: string } | { canceled: true }> => ({ canceled: true })
}

export function registerIpc(): void {
  const h = (ch: string, fn: (...a: never[]) => unknown) => ipcMain.handle(ch, (_e, ...args) => (fn as (...a: unknown[]) => unknown)(...args))

  h(IPC.vaultInfo, () => (state.vault ? { path: state.vault.root } : null))
  h(IPC.vaultChoose, async (create?: boolean) => {
    let path: string | undefined
    if (create) {
      path = defaultVaultPath()
    } else {
      const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], defaultPath: defaultVaultPath() })
      path = res.canceled ? undefined : res.filePaths[0]
    }
    if (!path) return null
    await openVault(path)
    await saveVaultPath(path)
    return { path }
  })
  h(IPC.vaultReveal, (id: string) => shell.showItemInFolder(requireVault().pathOf(id)))

  h(IPC.pagesTree, () => requireVault().tree())
  h(IPC.pagesRead, (id: string) => requireVault().read(id))
  h(IPC.pagesWrite, async (id: string, input: { markdown: string; meta: PageMeta }) => {
    const res = await requireVault().write(id, input)
    await hooks.afterWrite(id)
    return res
  })
  h(IPC.pagesCreate, (parentId: string | null, title?: string) => requireVault().create(parentId, title))
  h(IPC.pagesRename, (id: string, title: string) => requireVault().rename(id, title))
  h(IPC.pagesMove, (id: string, parentId: string | null, index: number) => requireVault().move(id, parentId, index))
  h(IPC.pagesTrash, (id: string) => requireVault().trash(id, (p) => shell.trashItem(p)))

  h(IPC.attachmentsSave, (bytes: Uint8Array, ext: string, nameHint?: string) => requireVault().saveAttachment(bytes, ext, nameHint))
  h(IPC.attachmentsFetchRemote, async (url: string) => {
    try {
      if (!/^https?:\/\//.test(url)) return null
      const res = await fetch(url)
      if (!res.ok) return null
      const type = res.headers.get('content-type') ?? ''
      if (!type.startsWith('image/')) return null
      const ext = type.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || extname(new URL(url).pathname).slice(1) || 'png'
      return await requireVault().saveAttachment(new Uint8Array(await res.arrayBuffer()), ext, 'web')
    } catch (e) {
      log.warn('Uzak görsel indirilemedi', url, e)
      return null
    }
  })

  h(IPC.searchQuery, (q: string, limit?: number) => hooks.search(q, limit))
  h(IPC.searchRecent, () => hooks.recent())
  h(IPC.pdfExport, (id: string, o: PdfOptions) => hooks.pdf(id, o))

  h(IPC.settingsGet, () => readSettings(requireVault().root))
  h(IPC.settingsSet, (patch: Partial<Settings>) => writeSettings(requireVault().root, patch))
}
