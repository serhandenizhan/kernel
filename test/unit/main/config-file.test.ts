import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  it('bozuk dosya boş sayılır ve yeni yazımla onarılır', async () => {
    const f = tmp()
    writeFileSync(f, '{bozuk')
    expect(await readConfigAt(f)).toEqual({})
    await updateConfigAt(f, { vaultPath: '/a' })
    expect(JSON.parse(readFileSync(f, 'utf8'))).toEqual({ vaultPath: '/a' })
  })
})
