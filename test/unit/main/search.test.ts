import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Vault } from '../../../src/main/vault/vault'
import { SearchIndex, plainText } from '../../../src/main/search'

let vault: Vault
let idx: SearchIndex
let ozId: string

beforeEach(async () => {
  vault = new Vault(mkdtempSync(join(tmpdir(), 'kernel-search-')))
  await vault.init()
  const oz = await vault.create(null, 'Özdeğerler')
  ozId = oz.id
  await vault.write(oz.id, { markdown: 'Özdeğerler **karakteristik polinom** ile bulunur.\n\n$$\n\\det(A - \\lambda I) = 0\n$$\n', meta: (await vault.read(oz.id)).meta })
  const f = await vault.create(null, 'Fizik')
  await vault.write(f.id, { markdown: 'Newton yasaları ve kuvvet.\n', meta: (await vault.read(f.id)).meta })
  idx = new SearchIndex()
  await idx.build(vault)
})

describe('SearchIndex', () => {
  it('Türkçe karaktersiz sorguyla başlıkta bulur', () => {
    expect(idx.query('ozdeger')[0]?.title).toBe('Özdeğerler')
  })
  it('büyük harfli Türkçe sorguyla içerikte bulur ve parça döner', () => {
    const hit = idx.query('KARAKTERİSTİK')[0]
    expect(hit?.id).toBe(ozId)
    expect(hit?.snippet).toContain('karakteristik polinom')
  })
  it('formül içindeki LaTeX de aranır', () => {
    expect(idx.query('lambda')[0]?.id).toBe(ozId)
  })
  it('update yeni kelimeyi bulur, remove bulmaz', async () => {
    await vault.write(ozId, { markdown: 'tamamen yeni içerik: spektral teorem\n', meta: (await vault.read(ozId)).meta })
    await idx.update(vault, ozId)
    expect(idx.query('spektral')[0]?.id).toBe(ozId)
    expect(idx.query('polinom')).toEqual([])
    idx.remove(ozId)
    expect(idx.query('spektral')).toEqual([])
  })
  it('boş sorgu boş döner', () => {
    expect(idx.query('  ')).toEqual([])
  })
})

describe('plainText', () => {
  it('Markdown işaretlerini temizler, kod ve formül metnini korur', () => {
    expect(plainText('# Başlık\n\n**kalın** ve `kod` $x^2$\n\n```py\nprint(1)\n```')).toBe('Başlık kalın ve kod x^2 print(1)')
  })
})
