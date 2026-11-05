import * as fsp from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { track } from '../pending'

type Fs = Pick<typeof fsp, 'open' | 'rename' | 'rm'>

// Windows'ta hedef dosyayı başka bir işlem (Defender, dizinleyici, eşitleme) kısa süre tutarsa rename EPERM/EBUSY/EACCES verir: kısa beklemelerle yeniden denenir
const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
async function renameRetry(fs: Fs, from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fs.rename(from, to)
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (!code || !RETRY_CODES.has(code) || attempt >= 8) throw e
      await new Promise((r) => setTimeout(r, 25 * (attempt + 1)))
    }
  }
}

// Yarım dosya bırakmayan yazma: geçici dosya → fsync → rename
export function writeAtomic(file: string, data: string | Uint8Array, fs: Fs = fsp): Promise<void> {
  // kapanışta yarım kalmasın diye takip edilir
  return track(write(file, data, fs))
}

async function write(file: string, data: string | Uint8Array, fs: Fs): Promise<void> {
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`
  try {
    const h = await fs.open(tmp, 'w')
    try {
      await h.writeFile(data)
      await h.sync()
    } finally {
      await h.close()
    }
    await renameRetry(fs, tmp, file)
  } catch (e) {
    await fs.rm(tmp, { force: true })
    throw e
  }
}
