import { existsSync, statSync } from 'node:fs'
import { readdir, readFile, rm } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { zipSync } from 'fflate'
import type { Settings } from '@shared/types'
import { writeAtomic } from './vault/atomic'

const SKIP_KERNEL = new Set(['.kernel/search-index.json', '.kernel/backup.json'])
const BACKUP_RE = /^Kernel-yedek-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/
const pad = (n: number) => String(n).padStart(2, '0')

async function collect(root: string, dir: string, skipDir: string | null, out: Record<string, Uint8Array>): Promise<void> {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, e.name)
    if (skipDir && resolve(abs) === skipDir) continue
    const rel = relative(root, abs).split(sep).join('/')
    if (e.isDirectory()) await collect(root, abs, skipDir, out)
    else if (e.isFile() && !SKIP_KERNEL.has(rel) && !e.name.endsWith('.tmp')) out[rel] = new Uint8Array(await readFile(abs))
  }
}

// Kasanın zip yedeği: Kernel-yedek-YYYY-MM-DD-HHmm.zip; son `keep` yedek tutulur
export async function makeBackup(root: string, folder: string, keep: number, now: Date = new Date()): Promise<string> {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) throw new Error('klasör bulunamadı')
  const r = resolve(folder)
  // yedek klasörü kasanın içindeyse kendini yedeklemesin
  const skip = r.startsWith(resolve(root) + sep) ? r : null
  const files: Record<string, Uint8Array> = {}
  await collect(root, root, skip, files)
  const name = `Kernel-yedek-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`
  const target = join(folder, name)
  await writeAtomic(target, zipSync(files, { level: 6 }))
  const backups = (await readdir(folder)).filter((n) => BACKUP_RE.test(n)).sort()
  for (const old of backups.slice(0, Math.max(0, backups.length - keep))) await rm(join(folder, old), { force: true })
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
