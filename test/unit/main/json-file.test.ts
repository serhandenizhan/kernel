import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readJsonFile } from '../../../src/main/vault/json-file'
import { loadOrder } from '../../../src/main/vault/order'

const dirs: string[] = []
const tmpDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'kernel-json-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

const err = (code: string) => Object.assign(new Error(code), { code })

describe('readJsonFile', () => {
  it('yalnızca ENOENT olduğunda varsayılana döner', async () => {
    const f = join(tmpDir(), 'yok.json')
    const res = await readJsonFile(f, () => ({ ok: true }))
    expect(res).toEqual({ value: { ok: true }, missing: true, corrupt: false })
  })

  it('geçici EBUSY hatasını yeniden dener ve başarıda veriyi döner', async () => {
    const f = join(tmpDir(), 'data.json')
    writeFileSync(f, JSON.stringify({ n: 42 }))
    let calls = 0
    const fs = {
      readFile: vi.fn(async (p: string, enc: BufferEncoding) => {
        calls++
        if (calls <= 2) throw err('EBUSY')
        return readFileSync(p, enc)
      }),
      rename: vi.fn()
    }
    const res = await readJsonFile(f, () => ({ n: 0 }), { fs: fs as never, retries: 4, delayMs: 1 })
    expect(calls).toBe(3)
    expect(res).toEqual({ value: { n: 42 }, missing: false, corrupt: false })
  })

  it('kalıcı EBUSY hatasında varsayılana dönmez, hatayı yukarı iletir', async () => {
    const f = join(tmpDir(), 'locked.json')
    writeFileSync(f, JSON.stringify({ n: 7 }))
    const fs = {
      readFile: vi.fn(async () => {
        throw err('EBUSY')
      }),
      rename: vi.fn()
    }
    await expect(readJsonFile(f, () => ({ n: 0 }), { fs: fs as never, retries: 2, delayMs: 1 })).rejects.toThrow('EBUSY')
    expect(readFileSync(f, 'utf8')).toBe('{"n":7}')
  })

  it('bozuk JSON dosyasını .corrupt-* olarak yedekler ve varsayılana döner', async () => {
    const dir = tmpDir()
    const f = join(dir, 'settings.json')
    writeFileSync(f, '{bozuk json')
    const onWarn = vi.fn()
    const res = await readJsonFile(f, () => ({ a: 1 }), { now: () => 123456, onWarn })
    expect(res).toEqual({ value: { a: 1 }, missing: false, corrupt: true })
    expect(existsSync(f)).toBe(false)
    expect(readFileSync(join(dir, 'settings.json.corrupt-123456'), 'utf8')).toBe('{bozuk json')
    expect(readdirSync(dir)).toEqual(['settings.json.corrupt-123456'])
    expect(onWarn).toHaveBeenCalledTimes(1)
  })

  it('loadOrder kalıcı EBUSY hatasında boş nesne uydurmaz, hatayı yukarı iletir', async () => {
    const dir = tmpDir()
    const lockedFs = {
      readFile: vi.fn(async () => {
        throw err('EBUSY')
      }),
      rename: vi.fn()
    }
    await expect(loadOrder(dir, { fs: lockedFs as never, retries: 1, delayMs: 1 })).rejects.toThrow('EBUSY')
  })
})
