import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir } from 'node:fs/promises'
import { extname } from 'node:path'
import { IPC } from '@shared/ipc'
import type { PageMeta, PdfOptions, Settings, TreeNode } from '@shared/types'
import { Vault } from './vault/vault'
import { watchVault } from './vault/watcher'
import { readSettings, writeSettings } from './vault/settings'
import { mainLang, mainT, setMainLanguage } from './i18n'
import { defaultVaultPath, saveVaultPath } from './config'
import { requireVault, state } from './state'
import { SearchIndex } from './search'
import { LinkIndex, rewriteLinksAfterRelocate } from './links'
import { SrsStore } from './srs'
import type { Deck, DeckInfo, ReviewRating } from '@shared/types'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { writeAtomic } from './vault/atomic'
import { exportPdf } from './pdf'
import { HistoryStore } from './history'
import { BackupScheduler, readLastBackup } from './backup'
import { TemplateStore, formatTemplateDate } from './templates'
import { exportHtml, exportMarkdownZip } from './export'
import { registerNotionIpc } from './notion/service'
import { splitFrontmatter } from './vault/frontmatter'
import { log } from './log'
import { PinStore } from './pins'
import { ActivityStore } from './activity'
import { computeHome, localDay } from '@core/home'

// ana sayfa canlı yenilemesi: değişiklikler 500 ms içinde tek olayda birleştirilir
let homeTimer: ReturnType<typeof setTimeout> | null = null
function notifyHome(): void {
  if (homeTimer) clearTimeout(homeTimer)
  homeTimer = setTimeout(() => {
    homeTimer = null
    broadcast(IPC.eventHomeChanged)
  }, 500)
}

// link dizini değişince geri bağlantı paneli / graf / etiketler tek olayla yenilenir
let linksTimer: ReturnType<typeof setTimeout> | null = null
function notifyLinks(): void {
  if (linksTimer) clearTimeout(linksTimer)
  linksTimer = setTimeout(() => {
    linksTimer = null
    broadcast(IPC.eventLinksChanged)
  }, 500)
}

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
  links = new LinkIndex()
  srs = new SrsStore(path)
  void links.build(vault).then(notifyLinks)
  const interval = process.env['KERNEL_TEST_HISTORY_INTERVAL_MS']
  history = new HistoryStore(path, undefined, interval !== undefined ? Number(interval) : undefined)
  void history.prune()
  activity = new ActivityStore(path)
  backupSettings = await readSettings(path)
  setMainLanguage(backupSettings.language)
  backups.stop()
  backups.start()
  recentIds = await loadRecent(path)
  state.stopWatcher = await watchVault(vault, (e) => {
    if (e.type === 'tree-changed') {
      broadcast(IPC.eventTreeChanged)
      void search?.build(vault)
      void links?.build(vault).then(notifyLinks)
    } else {
      broadcast(IPC.eventPageChanged, e.id)
      void search?.update(vault, e.id)
      void links?.update(vault, e.id).then(notifyLinks)
    }
    notifyHome()
  })
  // ilk kurulumda ısı haritası sayfaların son düzenlenme günleriyle kabaca doldurulur
  void vault
    .summaries()
    .then((pages) => activity?.seedIfMissing(pages))
    .catch((e) => log.warn('Etkinlik başlangıcı yazılamadı', e))
  log.info('Kasa açıldı', path)
}

let search: SearchIndex | null = null
let links: LinkIndex | null = null
let srs: SrsStore | null = null

/** Yeniden adlandırma / taşıma sonrası: kasadaki linkleri güncelle, dizinleri yenile, açık sayfalara haber ver */
async function relinkAfter(vault: Vault, id: string, before: TreeNode[]): Promise<void> {
  // toplu değişiklik geri alınabilsin: her sayfanın önceki hali sürüm geçmişine alınır
  const changed = await rewriteLinksAfterRelocate(vault, id, before, async (pid, text) => {
    await history?.snapshot(pid, text, { force: true })
  }).catch((e) => {
    log.warn('Linkler güncellenemedi', e)
    return [] as string[]
  })
  for (const c of changed) broadcast(IPC.eventPageChanged, c)
  void search?.build(vault)
  void links?.build(vault).then(notifyLinks)
}
let history: HistoryStore | null = null
let activity: ActivityStore | null = null
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

/** Kaydet diyaloğu (testlerde KERNEL_TEST_PDF_DIR klasörüne diyalogsuz) */
async function pickTarget(id: string, ext: 'pdf' | 'html' | 'zip', label: string): Promise<string | null> {
  const { title } = await requireVault().read(id)
  const name = `${title.replace(/[/:]/g, '-')}.${ext}`
  const testDir = process.env['KERNEL_TEST_PDF_DIR']
  if (testDir) return join(testDir, name)
  const res = await dialog.showSaveDialog({ defaultPath: join(app.getPath('documents'), name), filters: [{ name: label, extensions: [ext] }] })
  return res.canceled || !res.filePath ? null : res.filePath
}

async function exportPdfWithDialog(id: string, options: PdfOptions): Promise<{ filePath: string } | { canceled: true }> {
  const target = await pickTarget(id, 'pdf', 'PDF')
  if (!target) return { canceled: true }
  return { filePath: await exportPdf(requireVault(), id, options, target) }
}

export function registerIpc(): void {
  registerNotionIpc(broadcast)
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
          buttons: [mainT('ids.continue'), mainT('ids.cancel')],
          defaultId: 0,
          cancelId: 1,
          message: mainT('ids.message', { count: n }),
          detail: mainT('ids.detail')
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
    // sürüm geçmişi: yazmadan ÖNCEki hal saklanır (en fazla 5 dk'da bir) → düzenleme öncesi duruma dönülebilir
    try {
      await history?.snapshot(id, await readFile(vault.pathOf(id), 'utf8'))
    } catch (e) {
      log.warn('Anlık görüntü alınamadı', e)
    }
    const res = await vault.write(id, input)
    void search?.update(vault, id)
    void links?.update(vault, id).then(notifyLinks)
    // ana sayfa ısı haritası: bugün düzenlenen sayfalar
    void activity?.record(id).catch((e) => log.warn('Etkinlik kaydedilemedi', e))
    notifyHome()
    return res
  })
  h(IPC.pagesCreate, async (parentId: string | null, title?: string) => {
    const node = await requireVault().create(parentId, title)
    notifyHome()
    return node
  })
  h(IPC.pagesRename, async (id: string, title: string) => {
    const vault = requireVault()
    const before = await vault.tree()
    const node = await vault.rename(id, title)
    await relinkAfter(vault, id, before)
    notifyHome()
    return node
  })
  h(IPC.pagesMove, async (id: string, parentId: string | null, index: number) => {
    const vault = requireVault()
    const before = await vault.tree()
    await vault.move(id, parentId, index)
    await relinkAfter(vault, id, before)
    notifyHome()
  })
  h(IPC.pagesTrash, async (id: string) => {
    await requireVault().trash(id, (p) => shell.trashItem(p))
    search?.remove(id)
    void links?.build(requireVault()).then(notifyLinks)
    recentIds = recentIds.filter((x) => x !== id)
    await new PinStore(requireVault().root).remove(id).catch((e) => log.warn('Sabitleme kaldırılamadı', e))
    notifyHome()
  })

  h(IPC.linksBacklinks, (id: string) => links?.backlinks(id) ?? [])
  h(IPC.linksGraph, () => links?.graph() ?? { nodes: [], links: [] })
  h(IPC.tagsList, () => links?.tags() ?? [])
  h(IPC.studyDecks, async (): Promise<DeckInfo[]> => {
    if (!links || !srs) return []
    const all = links.allCards()
    await srs.sync(all)
    const info = async (deck: Deck, title: string): Promise<DeckInfo> => {
      const cards = links!.cardsIn(deck)
      return { deck, title, total: cards.length, due: (await srs!.due(cards)).length }
    }
    const out: DeckInfo[] = [await info({ kind: 'all' }, mainT('study.allCards'))]
    for (const p of links.cardPages()) out.push(await info(p.withChildren > p.own ? { kind: 'folder', id: p.id } : { kind: 'page', id: p.id }, p.title))
    for (const t of links.tags()) {
      const d = await info({ kind: 'tag', tag: t.tag }, `#${t.tag}`)
      if (d.total > 0) out.push(d)
    }
    return out
  })
  h(IPC.studySession, async (deck: Deck, exam: boolean) => {
    if (!links || !srs) return []
    const cards = links.cardsIn(deck)
    if (!exam) return srs.due(cards)
    // sınav modu: Fisher–Yates ile karıştır
    const a = [...cards]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j]!, a[i]!]
    }
    return a
  })
  h(IPC.studyReview, async (id: string, rating: ReviewRating) => {
    await srs?.review(id, rating)
    notifyHome()
  })
  h(IPC.studyDueCount, async () => (links && srs ? (await srs.due(links.allCards())).length : 0))
  h(IPC.tagsPages, (tag: string) => links?.pagesWithTag(tag) ?? [])

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
  h(IPC.exportMarkdown, async (id: string, includeSubpages: boolean) => {
    const target = await pickTarget(id, 'zip', 'Markdown (zip)')
    return target ? { filePath: await exportMarkdownZip(requireVault(), id, includeSubpages, target) } : { canceled: true }
  })
  h(IPC.exportHtml, async (id: string, o: PdfOptions) => {
    const target = await pickTarget(id, 'html', 'HTML')
    return target ? { filePath: await exportHtml(requireVault(), id, o, target) } : { canceled: true }
  })

  h(IPC.historyList, (id: string) => history?.list(id) ?? [])
  h(IPC.historyRead, async (id: string, versionId: string) => splitFrontmatter((await history!.read(id, versionId))).body)
  h(IPC.historyRestore, async (id: string, versionId: string) => {
    const vault = requireVault()
    const body = splitFrontmatter(await history!.read(id, versionId)).body
    // geri yükleme geri alınabilsin: şu anki hal (son 5 dk'nın düzenlemeleri dahil) önce saklanır
    await history!.snapshot(id, await readFile(vault.pathOf(id), 'utf8'), { force: true })
    const current = await vault.read(id)
    await vault.write(id, { markdown: body, meta: current.meta })
    void search?.update(vault, id)
  })
  // sabitlenenler: ağaçta olmayan (silinmiş) sayfalar listeden düşer
  h(IPC.pinsList, async () => {
    const vault = requireVault()
    const ids = new Set<string>()
    const walk = (ns: TreeNode[]) => ns.forEach((n) => (ids.add(n.id), walk(n.children)))
    walk(await vault.tree())
    return new PinStore(vault.root).list(ids)
  })
  h(IPC.pinsSet, async (ids: string[]) => {
    await new PinStore(requireVault().root).set(ids)
    notifyHome()
  })
  h(IPC.homeData, async () => {
    const vault = requireVault()
    const pages = await vault.summaries()
    const ids = new Set(pages.map((p) => p.id))
    const [pins, act] = await Promise.all([new PinStore(vault.root).list(ids), activity?.read() ?? {}])
    return computeHome(pages, pins, act, localDay(new Date()))
  })
  h(IPC.templatesList, async () => {
    const t = new TemplateStore(requireVault().root, undefined, mainLang())
    await t.ensureDefault()
    return t.list()
  })
  h(IPC.templatesCreate, async (parentId: string | null, name: string) => {
    const vault = requireVault()
    const t = new TemplateStore(vault.root, undefined, mainLang())
    const node = await vault.create(parentId, `${name} ${formatTemplateDate(new Date(), mainLang())}`)
    const { markdown, meta } = await t.render(name, node.title)
    const page = await vault.read(node.id)
    await vault.write(node.id, { markdown, meta: { ...page.meta, ...meta } })
    void search?.update(vault, node.id)
    return node
  })
  h(IPC.templatesSaveAs, async (id: string, name: string) => {
    const page = await requireVault().read(id)
    return new TemplateStore(requireVault().root, undefined, mainLang()).saveFrom(page.markdown, page.meta, name)
  })
  h(IPC.backupStatus, async () => ({ last: await readLastBackup(requireVault().root) }))
  h(IPC.backupNow, async () => {
    backupSettings = await readSettings(requireVault().root)
    const res = await backups.tick(true)
    if (res === 'done') return { filePath: backupSettings.backup.folder ?? '' }
    return { error: mainT('backup.failedShort') }
  })
  h(IPC.backupChooseFolder, async () => {
    // testlerde diyalog yerine verilen klasör
    const testDir = process.env['KERNEL_TEST_BACKUP_DIR']
    let folder: string | null = testDir ?? null
    if (!testDir) {
      const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], title: mainT('backup.chooseFolder') })
      folder = res.canceled ? null : (res.filePaths[0] ?? null)
    }
    if (folder) {
      const settings = await readSettings(requireVault().root)
      backupSettings = await writeSettings(requireVault().root, { backup: { ...settings.backup, folder } })
    }
    return folder
  })
  h(IPC.settingsGet, () => readSettings(requireVault().root))
  h(IPC.settingsSet, async (patch: Partial<Settings>) => {
    backupSettings = await writeSettings(requireVault().root, patch)
    setMainLanguage(backupSettings.language)
    return backupSettings
  })
  h(IPC.appLocale, () => app.getLocale())
}
