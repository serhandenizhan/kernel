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

describe('ayar şeması 2', () => {
  it("şeması olmayan eski ayar bir kerelik SF Pro'ya geçer ve diske yazılır", async () => {
    writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ bodyFont: 'serif', theme: 'dark' }))
    const s = await readSettings(root)
    expect(s).toMatchObject({ bodyFont: 'sans', theme: 'dark', schema: 2, language: 'system', startView: 'home' })
    expect(JSON.parse(readFileSync(join(root, '.kernel', 'settings.json'), 'utf8')).schema).toBe(2)
  })
  it("şema 2'de kullanıcının serif seçimi korunur", async () => {
    writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ bodyFont: 'serif', schema: 2 }))
    expect((await readSettings(root)).bodyFont).toBe('serif')
  })
  it('ayar dosyası yoksa varsayılanlar (göç yazımı yapılmaz)', async () => {
    expect(await readSettings(root)).toMatchObject({ bodyFont: 'sans', schema: 2 })
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
    writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ schema: 2, language: 'fr', startView: 'x', bodyFont: 'comic', theme: 'pink', pageWidth: 9 }))
    expect(await readSettings(root)).toMatchObject({ language: 'system', startView: 'home', bodyFont: 'sans', theme: 'system', pageWidth: 'normal' })
  })
  it('yazarken de tanınmayan değer saklanmaz', async () => {
    expect(await writeSettings(root, { language: 'xx' as never })).toMatchObject({ language: 'system' })
  })
})
