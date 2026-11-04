import * as fsp from 'node:fs/promises'
import { randomBytes } from 'node:crypto'

type Fs = Pick<typeof fsp, 'open' | 'rename' | 'rm'>

// Yarım dosya bırakmayan yazma: geçici dosya → fsync → rename
export async function writeAtomic(file: string, data: string | Uint8Array, fs: Fs = fsp): Promise<void> {
  const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`
  try {
    const h = await fs.open(tmp, 'w')
    try {
      await h.writeFile(data)
      await h.sync()
    } finally {
      await h.close()
    }
    await fs.rename(tmp, file)
  } catch (e) {
    await fs.rm(tmp, { force: true })
    throw e
  }
}
