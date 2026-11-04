import { createReadStream, createWriteStream, existsSync, realpathSync, statSync } from 'node:fs'
import { readdir, readFile, rename, rm } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import { Zip, ZipDeflate, ZipPassThrough } from 'fflate'
import type { Settings } from '@shared/types'
import { writeAtomic } from './vault/atomic'

const SKIP_KERNEL = new Set(['.kernel/search-index.json', '.kernel/backup.json'])
const BACKUP_RE = /^Kernel-yedek-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/
// zaten sıkıştırılmış biçimler yeniden sıkıştırılmaz (CPU ve süre tasarrufu)
const STORED = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.zip', '.mp4', '.mov', '.mp3', '.m4a', '.heic'])
const pad = (n: number) => String(n).padStart(2, '0')
const real = (p: string) => {
  try {
    return realpathSync(p)
  } catch {
    return resolve(p)
  }
}

async function listFiles(root: string, dir: string, skipDir: string | null, out: string[]): Promise<void> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name)
    if (skipDir && real(abs) === skipDir) continue
    if (e.isDirectory()) await listFiles(root, abs, skipDir, out)
    else if (e.isFile() && !e.name.endsWith('.tmp') && !e.name.endsWith('.part') && !BACKUP_RE.test(e.name)) {
      const rel = relative(root, abs).split(sep).join('/')
      if (!SKIP_KERNEL.has(rel)) out.push(rel)
    }
  }
}

// Kasanın zip yedeği: Kernel-yedek-YYYY-MM-DD-HHmm.zip; son `keep` yedek tutulur.
// Dosyalar tek tek akıtılır, zip doğrudan diske yazılır (büyük kasalarda belleği ve ana süreci kilitlemez).
export async function makeBackup(root: string, folder: string, keep: number, now: Date = new Date()): Promise<string> {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Error('klasör bulunamadı')
  const rootReal = real(root)
  const folderReal = real(folder)
  // yedek klasörü kasanın içindeyse kendini yedeklemesin (kasanın kendisiyse yedek dosyaları zaten atlanır)
  const skip = folderReal.startsWith(rootReal + sep) ? folderReal : null
  const files: string[] = []
  await listFiles(root, root, skip, files)
  const name = `Kernel-yedek-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`
  const target = join(folder, name)
  const part = `${target}.part`
  const ws = createWriteStream(part)
  try {
    await new Promise<void>((resolveZip, reject) => {
      ws.on('error', reject)
      const zip = new Zip((err, chunk, final) => {
        if (err) return reject(err)
        ws.write(chunk)
        if (final) ws.end(() => resolveZip())
      })
      void (async () => {
        try {
          for (const rel of files) {
            const entry = STORED.has(extname(rel).toLowerCase()) ? new ZipPassThrough(rel) : new ZipDeflate(rel, { level: 6 })
            zip.add(entry)
            for await (const chunk of createReadStream(join(root, rel))) {
              entry.push(chunk as Uint8Array)
              if (ws.writableNeedDrain) await new Promise((r) => ws.once('drain', r))
            }
            entry.push(new Uint8Array(0), true)
          }
          zip.end()
        } catch (e) {
          reject(e)
        }
      })()
    })
    await rename(part, target)
  } catch (e) {
    ws.destroy()
    await rm(part, { force: true })
    throw e
  }
  const backups = (await readdir(folder)).filter((n) => BACKUP_RE.test(n)).sort()
  const keepN = Math.max(1, keep)
  for (const old of backups.slice(0, Math.max(0, backups.length - keepN))) await rm(join(folder, old), { force: true })
  return target
}

const DAY_MS = 86_400_000

export async function readLastBackup(root: string): Promise<string | null> {
  try {
    return (JSON.parse(await readFile(join(root, '.kernel', 'backup.json'), 'utf8')) as { last?: string }).last ?? null
  } catch {
    return null
  }
}

// Günlük otomatik yedek: açılışta bir kez, sonra saatte bir kontrol
export class BackupScheduler {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly getState: () => { root: string; settings: Settings } | null,
    private readonly onError: (msg: string) => void,
    private readonly now: () => Date = () => new Date()
  ) {}

  /** Yedek alır; zorla değilse son yedekten 24 saat geçmediyse atlar */
  async tick(force = false): Promise<'done' | 'skipped' | 'failed'> {
    const st = this.getState()
    if (!st) return 'skipped'
    const { enabled, folder, keep } = st.settings.backup
    if ((!enabled && !force) || !folder) return 'skipped'
    const last = await readLastBackup(st.root)
    if (!force && last && this.now().getTime() - new Date(last).getTime() < DAY_MS) return 'skipped'
    try {
      await makeBackup(st.root, folder, keep, this.now())
      await writeAtomic(join(st.root, '.kernel', 'backup.json'), JSON.stringify({ last: this.now().toISOString() }))
      return 'done'
    } catch (e) {
      this.onError(`Yedek alınamadı: ${e instanceof Error ? e.message : 'bilinmeyen hata'}`)
      return 'failed'
    }
  }

  start(intervalMs = 3_600_000): void {
    void this.tick()
    this.timer = setInterval(() => void this.tick(), intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
