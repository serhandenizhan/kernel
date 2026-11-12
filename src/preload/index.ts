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
  exportAs: { markdown: inv(IPC.exportMarkdown), html: inv(IPC.exportHtml) } as KernelApi['exportAs'],
  history: { list: inv(IPC.historyList), read: inv(IPC.historyRead), restore: inv(IPC.historyRestore) } as KernelApi['history'],
  notion: {
    connect: inv(IPC.notionConnect),
    connected: inv(IPC.notionConnected),
    disconnect: inv(IPC.notionDisconnect),
    pages: inv(IPC.notionPages),
    start: inv(IPC.notionStart),
    resume: inv(IPC.notionResume),
    cancel: inv(IPC.notionCancel),
    pendingResume: inv(IPC.notionPending),
    onProgress: (cb: (p: never) => void) => on(IPC.notionProgress, cb)
  } as KernelApi['notion'],
  pins: { list: inv(IPC.pinsList), set: inv(IPC.pinsSet) } as KernelApi['pins'],
  home: { data: inv(IPC.homeData) } as KernelApi['home'],
  links: { backlinks: inv(IPC.linksBacklinks), graph: inv(IPC.linksGraph) } as KernelApi['links'],
  tags: { list: inv(IPC.tagsList), pages: inv(IPC.tagsPages) } as KernelApi['tags'],
  study: { decks: inv(IPC.studyDecks), session: inv(IPC.studySession), review: inv(IPC.studyReview), dueCount: inv(IPC.studyDueCount) } as KernelApi['study'],
  templates: { list: inv(IPC.templatesList), create: inv(IPC.templatesCreate), saveAs: inv(IPC.templatesSaveAs) } as KernelApi['templates'],
  backup: { now: inv(IPC.backupNow), status: inv(IPC.backupStatus), chooseFolder: inv(IPC.backupChooseFolder) } as KernelApi['backup'],
  settings: { get: inv(IPC.settingsGet), set: inv(IPC.settingsSet) } as KernelApi['settings'],
  updates: {
    check: inv(IPC.updatesCheck),
    open: inv(IPC.updatesOpen),
    install: inv(IPC.updatesInstall),
    checkNow: inv(IPC.updatesCheckNow),
    onProgress: (cb: (r: never) => void) => on(IPC.updatesProgress, cb)
  } as KernelApi['updates'],
  app: {
    locale: inv(IPC.appLocale),
    platform: process.platform,
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
    onPageChangedExternally: (cb) => on(IPC.eventPageChanged, cb),
    onToast: (cb) => on(IPC.eventToast, cb),
    onMenuCommand: (cb) => on(IPC.eventMenuCommand, cb),
    onHomeChanged: (cb) => on(IPC.eventHomeChanged, cb),
    onLinksChanged: (cb) => on(IPC.eventLinksChanged, cb)
  }
}

contextBridge.exposeInMainWorld('kernel', api)
