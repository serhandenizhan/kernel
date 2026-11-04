import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir } from 'node:fs/promises'
import { extname } from 'node:path'
import { IPC } from '@shared/ipc'
import type { PageMeta, PdfOptions, Settings } from '@shared/types'
import { Vault } from './vault/vault'
import { watchVault } from './vault/watcher'
import { readSettings, writeSettings } from './vault/settings'
import { defaultVaultPath, saveVaultPath } from './config'
import { requireVault, state } from './state'
import { SearchIndex } from './search'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeAtomic } from './vault/atomic'
import { exportPdf } from './pdf'
import { HistoryStore } from './history'
import { BackupScheduler, readLastBackup } from './backup'
import { splitFrontmatter } from './vault/frontmatter'
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
  search = new SearchIndex()
  void search.build(vault)
  const interval = process.env['KERNEL_TEST_HISTORY_INTERVAL_MS']
  history = new HistoryStore(path, undefined, interval !== undefined ? Number(interval) : undefined)
  void history.prune()
  backupSettings = await readSettings(path)
  backups.stop()
  backups.start()
  recentIds = await loadRecent(path)
  state.stopWatcher = await watchVault(vault, (e) => {
    if (e.type === 'tree-changed') {
      broadcast(IPC.eventTreeChanged)
      void search?.build(vault)
    } else {
      broadcast(IPC.eventPageChanged, e.id)
      void search?.update(vault, e.id)
    }
  })
  log.info('Kasa açıldı', path)
}

let search: SearchIndex | null = null
let history: HistoryStore | null = null
let backupSettings: Settings | null = null
const backups = new BackupScheduler(
  () => (state.vault && backupSettings ? { root: state.vault.root, settings: backupSettings } : null),
  (msg) => broadcast(IPC.eventToast, msg, 'error')
)
let recentIds: string[] = []
const RECENT_MAX = 8

async function loadRecent(root: string): Promise<string[]> {
  try {
    const v = JSON.parse(await readFile(join(root, '.kernel', 'recent.json'), 'utf8'))
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

/** Son açılan sayfalar (.kernel/recent.json) */
async function touchRecent(id: string): Promise<void> {
  recentIds = [id, ...recentIds.filter((x) => x !== id)].slice(0, RECENT_MAX)
  const root = state.vault?.root
  if (root) await writeAtomic(join(root, '.kernel', 'recent.json'), JSON.stringify(recentIds))
}

async function exportPdfWithDialog(id: string, options: PdfOptions): Promise<{ filePath: string } | { canceled: true }> {
  const vault = requireVault()
  const { title } = await vault.read(id)
  const name = `${title.replace(/[/:]/g, '-')}.pdf`
  // testlerde kaydet diyaloğu yerine verilen klasöre yazılır
  const testDir = process.env['KERNEL_TEST_PDF_DIR']
  let target: string
  if (testDir) {
    target = join(testDir, name)
  } else {
    const res = await dialog.showSaveDialog({ defaultPath: join(app.getPath('documents'), name), filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (res.canceled || !res.filePath) return { canceled: true }
    target = res.filePath
  }
  return { filePath: await exportPdf(vault, id, options, target) }
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
      // mevcut dosyalara kimlik yazmadan önce sor
      const n = path ? await Vault.countFilesNeedingId(path) : 0
      if (path && n > 0) {
        const answer = await dialog.showMessageBox({
          type: 'question',
          buttons: ['Devam et', 'Vazgeç'],
          defaultId: 0,
          cancelId: 1,
          message: `Bu klasördeki ${n} Markdown dosyasının başına küçük bir kimlik satırı eklenecek.`,
          detail: 'Notların içeriği değişmez; Kernel sayfaları tanıyabilmek için yalnızca dosyanın en başına bir "id" alanı yazar. node_modules ve kod depoları (.git) atlanır.'
        })
        if (answer.response !== 0) return null
      }
    }
    if (!path) return null
    await openVault(path)
    await saveVaultPath(path)
    return { path }
  })
  // boş id: kasa klasörünü aç
  h(IPC.vaultReveal, (id: string) => (id ? shell.showItemInFolder(requireVault().pathOf(id)) : void shell.openPath(requireVault().root)))

  h(IPC.pagesTree, () => requireVault().tree())
  h(IPC.pagesRead, async (id: string) => {
    const page = await requireVault().read(id)
    void touchRecent(id)
    return page
  })
  h(IPC.pagesWrite, async (id: string, input: { markdown: string; meta: PageMeta }) => {
    const vault = requireVault()
    const res = await vault.write(id, input)
    void search?.update(vault, id)
    // sürüm geçmişi: yazılan dosyanın tam metni (en fazla 5 dk'da bir)
    void readFile(vault.pathOf(id), 'utf8').then((text) => history?.snapshot(id, text)).catch((e) => log.warn('Anlık görüntü alınamadı', e))
    return res
  })
  h(IPC.pagesCreate, (parentId: string | null, title?: string) => requireVault().create(parentId, title))
  h(IPC.pagesRename, async (id: string, title: string) => {
    const node = await requireVault().rename(id, title)
    void search?.build(requireVault())
    return node
  })
  h(IPC.pagesMove, async (id: string, parentId: string | null, index: number) => {
    await requireVault().move(id, parentId, index)
    void search?.build(requireVault())
  })
  h(IPC.pagesTrash, async (id: string) => {
    await requireVault().trash(id, (p) => shell.trashItem(p))
    search?.remove(id)
    recentIds = recentIds.filter((x) => x !== id)
  })

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

  h(IPC.searchQuery, (q: string, limit?: number) => search?.query(q, limit) ?? [])
  h(IPC.searchRecent, async () => {
    const vault = requireVault()
    const out = []
    for (const id of recentIds) {
      try {
        const p = await vault.read(id)
        out.push({ id, title: p.title, path: p.path, icon: p.meta.icon, children: [] })
      } catch {
        // silinmiş sayfa
      }
    }
    return out
  })
  h(IPC.pdfExport, (id: string, o: PdfOptions) => exportPdfWithDialog(id, o))

  h(IPC.historyList, (id: string) => history?.list(id) ?? [])
  h(IPC.historyRead, async (id: string, versionId: string) => splitFrontmatter((await history!.read(id, versionId))).body)
  h(IPC.historyRestore, async (id: string, versionId: string) => {
    const vault = requireVault()
    const body = splitFrontmatter(await history!.read(id, versionId)).body
    const current = await vault.read(id)
    await vault.write(id, { markdown: body, meta: current.meta })
    // geri yükleme de yeni bir sürüm olur
    await history!.snapshot(id, await readFile(vault.pathOf(id), 'utf8'), { force: true })
    void search?.update(vault, id)
  })
  h(IPC.backupStatus, async () => ({ last: await readLastBackup(requireVault().root) }))
  h(IPC.backupNow, async () => {
    backupSettings = await readSettings(requireVault().root)
    const res = await backups.tick(true)
    if (res === 'done') return { filePath: backupSettings.backup.folder ?? '' }
    return { error: 'Yedek alınamadı' }
  })
  h(IPC.backupChooseFolder, async () => {
    // testlerde diyalog yerine verilen klasör
    const testDir = process.env['KERNEL_TEST_BACKUP_DIR']
    let folder: string | null = testDir ?? null
    if (!testDir) {
      const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], title: 'Yedek klasörü seç' })
      folder = res.canceled ? null : (res.filePaths[0] ?? null)
    }
    if (folder) {
      const settings = await readSettings(requireVault().root)
      backupSettings = await writeSettings(requireVault().root, { backup: { ...settings.backup, folder } })
    }
    return folder
  })
  h(IPC.settingsGet, () => readSettings(requireVault().root))
  h(IPC.settingsSet, async (patch: Partial<Settings>) => (backupSettings = await writeSettings(requireVault().root, patch)))
}
