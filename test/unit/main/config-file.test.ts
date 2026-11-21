import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readConfigAt, updateConfigAt } from '../../../src/main/config-file'

const dirs: string[] = []
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'kernel-cfg-'))
  dirs.push(d)
  return join(d, 'config.json')
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

describe('uygulama ayar dosyası', () => {
  it('dosya yoksa boş nesne; güncellemeler birleşir, eski alanlar silinmez', async () => {
    const f = tmp()
    expect(await readConfigAt(f)).toEqual({})
    await updateConfigAt(f, { vaultPath: '/a' })
    await updateConfigAt(f, { unsplashKey: 'k1' })
    expect(await readConfigAt(f)).toEqual({ vaultPath: '/a', unsplashKey: 'k1' })
    await updateConfigAt(f, { vaultPath: '/b' })
    expect(await readConfigAt(f)).toEqual({ vaultPath: '/b', unsplashKey: 'k1' })
  })
  it('anahtar boş verilince silinir', async () => {
    const f = tmp()
    await updateConfigAt(f, { unsplashKey: 'k1', vaultPath: '/a' })
    await updateConfigAt(f, { unsplashKey: '' })
    expect(await readConfigAt(f)).toEqual({ vaultPath: '/a' })
  })
  it('bozuk dosya .corrupt-* yedeğine taşınır ve yeni yazımla onarılır', async () => {
    const f = tmp()
    writeFileSync(f, '{bozuk')
    expect(await readConfigAt(f)).toEqual({})
    expect(readdirSync(dirname(f)).some((n) => n.startsWith('config.json.corrupt-'))).toBe(true)
    await updateConfigAt(f, { vaultPath: '/a' })
    expect(JSON.parse(readFileSync(f, 'utf8'))).toEqual({ vaultPath: '/a' })
  })
  it('okuma kalıcı EBUSY verirse dosyayı ezmez ve hatayı iletir', async () => {
    const f = tmp()
    writeFileSync(f, JSON.stringify({ vaultPath: '/korunan' }))
    const lockedFs = {
      readFile: async () => {
        throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' })
      },
      rename: async () => undefined
    }
    await expect((updateConfigAt as (file: string, patch: object, opts?: object) => Promise<void>)(f, { unsplashKey: 'yeni' }, { fs: lockedFs, retries: 1, delayMs: 1 })).rejects.toThrow('EBUSY')
    expect(JSON.parse(readFileSync(f, 'utf8'))).toEqual({ vaultPath: '/korunan' })
  })
  it.skipIf(process.platform === 'win32')('config.json 0600 izinle yazılır', async () => {
    const f = tmp()
    await updateConfigAt(f, { unsplashKey: 'gizli' })
    expect(statSync(f).mode & 0o777).toBe(0o600)
  })
})
