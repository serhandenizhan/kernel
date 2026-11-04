import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { KernelApi } from '@shared/types'

const inv =
  (ch: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(ch, ...args)

const on = (ch: string, cb: (...a: never[]) => void) => {
  const listener = (_e: unknown, ...args: unknown[]) => (cb as (...a: unknown[]) => void)(...args)
  ipcRenderer.on(ch, listener)
  return () => {
    ipcRenderer.removeListener(ch, listener)
  }
}

// Arayüzün ana sürece erişebildiği tek yol
const api: KernelApi = {
  vault: { info: inv(IPC.vaultInfo), choose: inv(IPC.vaultChoose), reveal: inv(IPC.vaultReveal) } as KernelApi['vault'],
  pages: {
    tree: inv(IPC.pagesTree),
    read: inv(IPC.pagesRead),
    write: inv(IPC.pagesWrite),
    create: inv(IPC.pagesCreate),
    rename: inv(IPC.pagesRename),
    move: inv(IPC.pagesMove),
    trash: inv(IPC.pagesTrash)
  } as KernelApi['pages'],
  attachments: { save: inv(IPC.attachmentsSave), fetchRemote: inv(IPC.attachmentsFetchRemote) } as KernelApi['attachments'],
  search: { query: inv(IPC.searchQuery), recent: inv(IPC.searchRecent) } as KernelApi['search'],
  pdf: { export: inv(IPC.pdfExport) } as KernelApi['pdf'],
  settings: { get: inv(IPC.settingsGet), set: inv(IPC.settingsSet) } as KernelApi['settings'],
  app: {
    onFlushRequest(cb) {
      ipcRenderer.on(IPC.appFlush, async () => {
        let ok = false
        try {
          ok = await cb()
        } finally {
          ipcRenderer.send(IPC.appFlushDone, ok)
        }
      })
    }
  },
  events: {
    onTreeChanged: (cb) => on(IPC.eventTreeChanged, cb),
    onPageChangedExternally: (cb) => on(IPC.eventPageChanged, cb)
  }
}

contextBridge.exposeInMainWorld('kernel', api)
