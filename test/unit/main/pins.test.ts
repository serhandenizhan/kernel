import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PinStore } from '../../../src/main/pins'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kernel-pins-'))
})

describe('PinStore', () => {
  it('dosya yoksa boş liste', async () => {
    expect(await new PinStore(root).list()).toEqual([])
  })
  it('sırayı korur, yinelenenleri atar, .kernel/pins.json içine yazar', async () => {
    const p = new PinStore(root)
    await p.set(['a', 'b', 'a'])
    expect(await p.list()).toEqual(['a', 'b'])
    expect(JSON.parse(readFileSync(join(root, '.kernel', 'pins.json'), 'utf8'))).toEqual({ ids: ['a', 'b'] })
  })
  it('keep verilince bulunmayan kimlikleri listeden ve dosyadan temizler', async () => {
    const p = new PinStore(root)
    await p.set(['a', 'silindi', 'b'])
    expect(await p.list(new Set(['a', 'b']))).toEqual(['a', 'b'])
    expect(JSON.parse(readFileSync(join(root, '.kernel', 'pins.json'), 'utf8')).ids).toEqual(['a', 'b'])
  })
})
