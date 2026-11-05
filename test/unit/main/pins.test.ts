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
  it('keep verilince bulunmayan kimlikleri listede göstermez', async () => {
    const p = new PinStore(root)
    await p.set(['a', 'silindi', 'b'])
    expect(await p.list(new Set(['a', 'b']))).toEqual(['a', 'b'])
  })
})

describe('PinStore okuma', () => {
  it('okumak dosyayı değiştirmez (geçici olarak görünmeyen sayfanın sabitlemesi kaybolmaz)', async () => {
    const p = new PinStore(root)
    await p.set(['a', 'gecici', 'b'])
    expect(await p.list(new Set(['a', 'b']))).toEqual(['a', 'b'])
    expect(JSON.parse(readFileSync(join(root, '.kernel', 'pins.json'), 'utf8')).ids).toEqual(['a', 'gecici', 'b'])
    expect(await p.list(new Set(['a', 'gecici', 'b']))).toEqual(['a', 'gecici', 'b'])
  })
  it('remove yalnızca verilen kimliği siler', async () => {
    const p = new PinStore(root)
    await p.set(['a', 'b'])
    await p.remove('a')
    expect(await p.list()).toEqual(['b'])
  })
})
