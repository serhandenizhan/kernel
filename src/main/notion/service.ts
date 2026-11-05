import { app, ipcMain } from 'electron'
import { readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { IPC } from '@shared/ipc'
import { pageTitleOf } from '@core/notion/convert'
import { NotionClient, NotionError } from './client'
import { FixtureNotionClient, type NotionApi } from './fixture-client'
import { NotionImporter, type ImportProgress } from './importer'
import { clearToken, loadToken, saveToken, type SecretStore } from '../secrets'
import { requireVault } from '../state'
import { log } from '../log'
import { mainLang, mainT } from '../i18n'

const DOWNLOAD_TIMEOUT_MS = 30_000
const MAX_BYTES = 50 * 1024 * 1024
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'application/pdf': 'pdf' }

/** Testlerde Keychain penceresi açılmasın diye basit (güvensiz) saklama; uygulamada safeStorage */
function store(): SecretStore | undefined {
  if (!process.env['KERNEL_TEST']) return undefined
  const xor = (b: Buffer) => Buffer.from([...b].map((x) => x ^ 0x37))
  return { file: join(app.getPath('userData'), 'notion-token.bin'), encrypt: (s) => xor(Buffer.from(s)), decrypt: (b) => xor(b).toString() }
}

/** Gerçek istemci ya da (test) sentetik veriden yanıt veren istemci */
function clientFor(token: string): NotionApi {
  const fixture = process.env['KERNEL_TEST_NOTION_FIXTURES']
  if (fixture) {
    if (!token.startsWith('secret_')) {
      return { me: async () => Promise.reject(new NotionError(mainT('notionErr.token'), 401, 'unauthorized')) } as unknown as NotionApi
    }
    return new FixtureNotionClient(JSON.parse(readFileSync(fixture, 'utf8')))
  }
  return new NotionClient(token)
}

/** Dosyayı (Notion'ın süreli linkinden) indirip kasaya kaydeder; başarısızsa null */
async function download(url: string, nameHint: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) })
    if (!res.ok) return null
    if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length > MAX_BYTES) return null
    const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim()
    const ext = EXT[type] ?? (url.startsWith('data:') ? 'bin' : extname(new URL(url).pathname).slice(1).toLowerCase()) ?? 'bin'
    return await requireVault().saveAttachment(bytes, ext || 'bin', nameHint)
  } catch (e) {
    log.warn('Notion dosyası indirilemedi', e instanceof Error ? e.message : 'bilinmeyen')
    return null
  }
}

let running: NotionImporter | null = null

export function registerNotionIpc(broadcast: (channel: string, ...args: unknown[]) => void): void {
  const h = (ch: string, fn: (...a: never[]) => unknown) => ipcMain.handle(ch, (_e, ...args) => (fn as (...a: unknown[]) => unknown)(...args))
  const progress = (p: ImportProgress) => broadcast(IPC.notionProgress, p)

  const importer = async () => {
    const token = await loadToken(store())
    if (!token) throw new Error(mainT('notionErr.connectFirst'))
    running = new NotionImporter({ client: clientFor(token), vault: requireVault(), download, onProgress: progress, lang: mainLang() })
    return running
  }
  const runInBackground = (job: Promise<unknown>) =>
    void job
      .catch((e) => log.warn('Notion aktarımı durdu', e instanceof Error ? e.message : 'bilinmeyen'))
      .finally(() => {
        running = null
        broadcast(IPC.eventTreeChanged)
      })

  h(IPC.notionConnect, async (token: string) => {
    try {
      const { workspaceName } = await clientFor(token.trim()).me()
      await saveToken(token.trim(), store())
      return { ok: true, workspace: workspaceName }
    } catch (e) {
      return { ok: false, error: e instanceof NotionError ? e.message : mainT('notionErr.connectFailed') }
    }
  })
  h(IPC.notionConnected, async () => (await loadToken(store())) !== null)
  h(IPC.notionDisconnect, () => clearToken(store()))
  h(IPC.notionPages, async () => {
    const token = await loadToken(store())
    if (!token) return []
    const client = clientFor(token)
    const all = []
    let cursor: string | undefined
    do {
      const res = await client.search(cursor)
      all.push(...res.results)
      cursor = res.next_cursor ?? undefined
    } while (cursor)
    const titles = new Map(all.map((p) => [p.id, pageTitleOf(p) || mainT('page.untitled')]))
    // üst seviye sayfalar (alt sayfalar zaten onlarla birlikte gelir)
    return all
      .filter((p) => p.parent.type === 'workspace' || !titles.has(p.parent.page_id ?? ''))
      .map((p) => ({ id: p.id, title: titles.get(p.id)!, icon: p.icon?.type === 'emoji' ? p.icon.emoji : undefined }))
  })
  h(IPC.notionStart, async (ids: string[]) => {
    if (running) throw new Error(mainT('notionErr.running'))
    runInBackground((await importer()).run(ids))
  })
  h(IPC.notionResume, async () => {
    if (running) return
    runInBackground((await importer()).resume())
  })
  h(IPC.notionCancel, () => running?.cancel())
  h(IPC.notionPending, () => NotionImporter.pending(requireVault()))
}
