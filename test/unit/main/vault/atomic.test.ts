import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as fsp from 'node:fs/promises'
import { writeAtomic } from '../../../../src/main/vault/atomic'

describe('writeAtomic', () => {
  it('dosyayı yazar ve geçici dosya bırakmaz', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kernel-atomic-'))
    const f = join(dir, 'a.md')
    await writeAtomic(f, 'yeni')
    expect(readFileSync(f, 'utf8')).toBe('yeni')
    expect(readdirSync(dir)).toEqual(['a.md'])
  })
  it('rename başarısız olursa eski içerik korunur ve .tmp silinir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kernel-atomic-'))
    const f = join(dir, 'a.md')
    writeFileSync(f, 'eski')
    const failingFs = { ...fsp, rename: async () => { throw new Error('disk') } }
    await expect(writeAtomic(f, 'yeni', failingFs)).rejects.toThrow('disk')
    expect(readFileSync(f, 'utf8')).toBe('eski')
    expect(readdirSync(dir)).toEqual(['a.md'])
  })
  it('Windows: dosya kısa süre kilitliyse (EPERM/EBUSY) rename yeniden denenir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kernel-atomic-'))
    const f = join(dir, 'a.md')
    writeFileSync(f, 'eski')
    let calls = 0
    const flakyFs = {
      ...fsp,
      rename: async (...args: Parameters<typeof fsp.rename>) => {
        calls++
        if (calls < 3) throw Object.assign(new Error('locked'), { code: calls === 1 ? 'EPERM' : 'EBUSY' })
        return fsp.rename(...args)
      }
    }
    await writeAtomic(f, 'yeni', flakyFs)
    expect(readFileSync(f, 'utf8')).toBe('yeni')
    expect(calls).toBe(3)
    expect(readdirSync(dir)).toEqual(['a.md'])
  })
})
