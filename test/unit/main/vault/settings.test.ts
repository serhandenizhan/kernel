import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSettings, writeSettings } from '../../../../src/main/vault/settings'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kernel-set-'))
  mkdirSync(join(root, '.kernel'))
})

describe('ayar şeması 3', () => {
  it("eski ayar bir kerelik IBM Plex Sans'a geçer ve diske yazılır", async () => {
    writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ bodyFont: 'serif', theme: 'dark' }))
    const s = await readSettings(root)
    expect(s).toMatchObject({ bodyFont: 'plex', theme: 'dark', schema: 3, language: 'system', startView: 'home' })
    expect(JSON.parse(readFileSync(join(root, '.kernel', 'settings.json'), 'utf8')).schema).toBe(3)
  })
  it("şema 2'deki SF Pro seçimi de bir kerelik Plex'e geçer", async () => {
    writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ bodyFont: 'sans', schema: 2 }))
    expect((await readSettings(root)).bodyFont).toBe('plex')
  })
  it("şema 3'te kullanıcının seçimi korunur", async () => {
    writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ bodyFont: 'serif', schema: 3 }))
    expect((await readSettings(root)).bodyFont).toBe('serif')
    writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ bodyFont: 'sans', schema: 3 }))
    expect((await readSettings(root)).bodyFont).toBe('sans')
  })
  it('ayar dosyası yoksa varsayılanlar (göç yazımı yapılmaz)', async () => {
    expect(await readSettings(root)).toMatchObject({ bodyFont: 'plex', schema: 3 })
    expect(existsSync(join(root, '.kernel', 'settings.json'))).toBe(false)
  })
})

describe('writeSettings', () => {
  it('art arda yapılan değişiklikler birbirini ezmez', async () => {
    await Promise.all([writeSettings(root, { theme: 'dark' }), writeSettings(root, { pageWidth: 'wide' }), writeSettings(root, { startView: 'last' })])
    expect(await readSettings(root)).toMatchObject({ theme: 'dark', pageWidth: 'wide', startView: 'last' })
  })
})

describe('ayar doğrulama', () => {
  it('tanınmayan değerler varsayılana döner', async () => {
    writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ schema: 3, language: 'fr', startView: 'x', bodyFont: 'comic', theme: 'pink', pageWidth: 9 }))
    expect(await readSettings(root)).toMatchObject({ language: 'system', startView: 'home', bodyFont: 'plex', theme: 'system', pageWidth: 'normal' })
  })
  it('yazarken de tanınmayan değer saklanmaz', async () => {
    expect(await writeSettings(root, { language: 'xx' as never })).toMatchObject({ language: 'system' })
  })
})

describe('güncelleme ayarı', () => {
  it('varsayılan açık; elle bozulmuş değer güvenli değere döner, kısmi yazım diğer alanı korur', async () => {
    expect((await readSettings(root)).updates).toEqual({ check: true, skipped: null })
    writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ schema: 2, updates: { check: 'evet', skipped: 5 } }))
    expect((await readSettings(root)).updates).toEqual({ check: true, skipped: null })
    await writeSettings(root, { updates: { check: false, skipped: null } })
    expect((await writeSettings(root, { updates: { skipped: '0.5.0' } as never })).updates).toEqual({ check: false, skipped: '0.5.0' })
  })
})
