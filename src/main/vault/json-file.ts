import * as fsp from 'node:fs/promises'
import { log } from '../log'

const RETRY_CODES = new Set(['EBUSY', 'EPERM', 'EACCES'])

export interface JsonFileOpts {
  fs?: Pick<typeof fsp, 'readFile' | 'rename'>
  retries?: number
  delayMs?: number
  now?: () => number
  onWarn?: (msg: string, err?: unknown) => void
}

/**
 * JSON dosyasını güvenle okur:
 * - Yalnızca ENOENT durumunda `missing: true` ile varsayılanı döner.
 * - EBUSY/EPERM/EACCES gibi geçici kilitlemelerde kısa bekleyip yeniden dener; sürerse hatayı fırlatır (dosya ezilmesin).
 * - Geçersiz JSON (SyntaxError) durumunda dosyayı `.corrupt-<zaman>` olarak yedekleyip uyarır ve varsayılanı döner.
 */
export async function readJsonFile<T>(file: string, fallback: () => T, opts: JsonFileOpts = {}): Promise<{ value: T; missing: boolean; corrupt: boolean }> {
  const fs = opts.fs ?? fsp
  const retries = opts.retries ?? 5
  const delayMs = opts.delayMs ?? 25
  const warn = opts.onWarn ?? ((msg, err) => log.warn(msg, err))

  let text = ''
  for (let attempt = 0; ; attempt++) {
    try {
      text = await fs.readFile(file, 'utf8')
      break
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return { value: fallback(), missing: true, corrupt: false }
      if (code && RETRY_CODES.has(code) && attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)))
        continue
      }
      throw e
    }
  }

  try {
    return { value: JSON.parse(text) as T, missing: false, corrupt: false }
  } catch (e) {
    if (e instanceof SyntaxError) {
      const backup = `${file}.corrupt-${(opts.now ?? Date.now)()}`
      await fs.rename(file, backup).catch(() => undefined)
      warn(`Bozuk JSON yedeklendi: ${backup}`, e.message)
      return { value: fallback(), missing: false, corrupt: true }
    }
    throw e
  }
}
