import { app, net } from 'electron'
import { spawn, execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { access, copyFile, mkdtemp, open, readdir, stat, writeFile, constants } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { canSelfUpdate, isReleaseUrl, macBundleFromExe, macSwapScript, type UpdateInfo } from '@core/update'

// Uygulama içi güncelleme: yeni sürüm indirilir, doğrulanır, uygulama kapanınca yerine konur ve yeniden açılır.
// Apple imzası olmadığı için Squirrel kullanılamıyor; macOS'ta paket küçük bir betikle değiştirilir,
// Windows'ta NSIS kurulumu sessiz çalışıp uygulamayı yeniden başlatır.

const run = promisify(execFile)
const BUNDLE_ID = 'app.kernel.notes'

export type InstallResult = 'restarting' | 'manual'
export interface InstallPlan {
  cmd: string
  args: string[]
}

async function download(url: string, file: string, onProgress: (ratio: number) => void): Promise<void> {
  // testlerde ağa çıkılmaz: yerel dosya "indirilir"
  const local = process.env['KERNEL_TEST_UPDATE_ASSET']
  if (local) {
    await copyFile(local, file)
    onProgress(1)
    return
  }
  const res = await net.fetch(url, { headers: { 'User-Agent': 'Kernel-App' } })
  if (!res.ok || !res.body) throw new Error(`download ${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0
  const out = createWriteStream(file)
  let got = 0
  const reader = res.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      got += value.byteLength
      if (!out.write(value)) await new Promise<void>((r) => out.once('drain', () => r()))
      if (total) onProgress(Math.min(1, got / total))
    }
  } finally {
    await new Promise<void>((r) => out.end(() => r()))
  }
  if (total && got !== total) throw new Error('download incomplete')
}

async function plist(file: string, key: string): Promise<string> {
  const { stdout } = await run('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', file])
  return stdout.trim()
}

async function prepareMac(info: UpdateInfo, dir: string, zip: string): Promise<InstallPlan | null> {
  const bundle = macBundleFromExe(app.getPath('exe'))
  if (!bundle || !canSelfUpdate(bundle)) return null
  // paketin bulunduğu klasöre yazılamıyorsa (örn. başka kullanıcının /Applications'ı) elle indirmeye düşülür
  try {
    await access(dirname(bundle), constants.W_OK)
  } catch {
    return null
  }
  const out = join(dir, 'x')
  await run('/usr/bin/ditto', ['-x', '-k', zip, out])
  const name = (await readdir(out)).find((n) => n.endsWith('.app'))
  if (!name) throw new Error('no app in zip')
  const fresh = join(out, name)
  // indirilen paket gerçekten Kernel'in beklenen sürümü mü
  const info_ = join(fresh, 'Contents', 'Info.plist')
  if ((await plist(info_, 'CFBundleIdentifier')) !== BUNDLE_ID) throw new Error('bundle id mismatch')
  if ((await plist(info_, 'CFBundleShortVersionString')) !== info.version) throw new Error('version mismatch')
  const script = join(dir, 'swap.sh')
  await writeFile(script, macSwapScript(), { mode: 0o755 })
  return { cmd: '/bin/sh', args: [script, String(process.pid), bundle, fresh] }
}

async function prepareWin(exe: string): Promise<InstallPlan> {
  // Windows çalıştırılabilir dosyası "MZ" ile başlar; boş / HTML hata sayfası kurulmaz
  const fh = await open(exe, 'r')
  try {
    const buf = Buffer.alloc(2)
    await fh.read(buf, 0, 2, 0)
    if (buf.toString('latin1') !== 'MZ' || (await stat(exe)).size < 1024) throw new Error('not an installer')
  } finally {
    await fh.close()
  }
  return { cmd: exe, args: ['/S', '--updated', '--force-run'] }
}

/** İndirir, doğrular ve kurulumu başlatır; bu platformda kendini güncelleyemiyorsa 'manual' döner (arayüz indirme sayfasını açar) */
export async function installUpdate(info: UpdateInfo, onProgress: (ratio: number) => void): Promise<InstallResult> {
  const url = info.install
  if (!url || !isReleaseUrl(url)) return 'manual'
  if (process.platform !== 'darwin' && process.platform !== 'win32') return 'manual'
  if (process.platform === 'darwin' && !canSelfUpdate(macBundleFromExe(app.getPath('exe')) ?? '/Volumes/')) return 'manual'
  const dir = await mkdtemp(join(app.getPath('temp'), 'kernel-update-'))
  const file = join(dir, process.platform === 'win32' ? `Kernel-Setup-${info.version}.exe` : 'update.zip')
  await download(url, file, onProgress)
  const plan = process.platform === 'win32' ? await prepareWin(file) : await prepareMac(info, dir, file)
  if (!plan) return 'manual'
  // testlerde kurulum planı dosyaya yazılır; hiçbir şey çalıştırılmaz, uygulama kapanmaz
  const dry = process.env['KERNEL_TEST_UPDATE_DRYRUN']
  if (dry) {
    await writeFile(dry, JSON.stringify(plan))
    return 'restarting'
  }
  spawn(plan.cmd, plan.args, { detached: true, stdio: 'ignore' }).unref()
  // kaydedilmemiş yazımlar kapanışta beklenir (pending.ts)
  setTimeout(() => app.quit(), 300)
  return 'restarting'
}
