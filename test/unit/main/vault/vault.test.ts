import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Vault } from '../../../../src/main/vault/vault'
import { readSettings, writeSettings } from '../../../../src/main/vault/settings'
import { DEFAULT_SETTINGS } from '@shared/types'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kernel-vault-'))
})
const titles = (nodes: { title: string }[]) => nodes.map((n) => n.title)

describe('Vault', () => {
  it('alt sayfa klasörüyle ağaç kurar', async () => {
    writeFileSync(join(root, 'A.md'), 'a')
    mkdirSync(join(root, 'A'))
    writeFileSync(join(root, 'A', 'B.md'), 'b')
    const v = new Vault(root)
    await v.init()
    const tree = await v.tree()
    expect(titles(tree)).toEqual(['A'])
    expect(titles(tree[0]!.children)).toEqual(['B'])
    expect(tree[0]!.children[0]!.path).toBe('A/B.md')
  })

  it('gizli klasörleri ve attachments klasörünü ağaca koymaz', async () => {
    writeFileSync(join(root, 'A.md'), 'a')
    const v = new Vault(root)
    await v.init()
    writeFileSync(join(root, 'attachments', 'x.md'), '')
    expect(titles(await v.tree())).toEqual(['A'])
  })

  it('id olmayan dosyaya kalıcı id ekler', async () => {
    writeFileSync(join(root, 'A.md'), 'gövde')
    const v = new Vault(root)
    await v.init()
    const id = (await v.tree())[0]!.id
    expect(readFileSync(join(root, 'A.md'), 'utf8')).toContain(`id: ${id}`)
    const v2 = new Vault(root)
    await v2.init()
    expect((await v2.tree())[0]!.id).toBe(id)
    expect((await v2.read(id)).markdown).toBe('gövde')
  })

  it('ikili dosyaya id yazmaz ama ağaçta gösterir', async () => {
    writeFileSync(join(root, 'Bozuk.md'), 'a\u0000b')
    const v = new Vault(root)
    await v.init()
    expect(readFileSync(join(root, 'Bozuk.md'), 'utf8')).toBe('a\u0000b')
    const tree = await v.tree()
    expect(tree[0]!.title).toBe('Bozuk')
    expect((await v.read(tree[0]!.id)).markdown).toBe('a\u0000b')
  })

  it('NFD dosya adını NFC başlık olarak verir', async () => {
    writeFileSync(join(root, 'Özdeğerler.md'), '')
    const v = new Vault(root)
    await v.init()
    expect((await v.tree())[0]!.title).toBe('Özdeğerler')
  })

  it('create alt sayfa klasörünü oluşturur ve varsayılan başlık Adsız', async () => {
    const v = new Vault(root)
    await v.init()
    const a = await v.create(null, 'Fizik')
    const b = await v.create(a.id)
    expect(b.path).toBe('Fizik/Adsız.md')
    expect(existsSync(join(root, 'Fizik', 'Adsız.md'))).toBe(true)
  })

  it('rename alt sayfa klasörünü de taşır ve id korunur', async () => {
    const v = new Vault(root)
    await v.init()
    const a = await v.create(null, 'A')
    const b = await v.create(a.id, 'B')
    const renamed = await v.rename(a.id, 'C')
    expect(renamed.id).toBe(a.id)
    expect(existsSync(join(root, 'C.md'))).toBe(true)
    expect(existsSync(join(root, 'C', 'B.md'))).toBe(true)
    expect(existsSync(join(root, 'A'))).toBe(false)
    expect((await v.read(b.id)).path).toBe('C/B.md')
  })

  it('move büyük/küçük harf çakışmasında (2) ekler', async () => {
    const v = new Vault(root)
    await v.init()
    const p = await v.create(null, 'Üst')
    await v.create(p.id, 'fizik')
    const x = await v.create(null, 'Fizik')
    await v.move(x.id, p.id, 0)
    expect((await v.read(x.id)).path).toBe('Üst/Fizik (2).md')
  })

  it('order sırasını uygular, yeniler alfabetik olarak sona eklenir', async () => {
    const v = new Vault(root)
    await v.init()
    const b = await v.create(null, 'B')
    const a = await v.create(null, 'A')
    await v.move(b.id, null, 0)
    writeFileSync(join(root, 'C.md'), '')
    const v2 = new Vault(root)
    await v2.init()
    expect(titles(await v2.tree())).toEqual(['B', 'A', 'C'])
    expect(a.title).toBe('A')
  })

  it('write gövdeyi ve meta alanlarını yazar, updated günceller', async () => {
    const v = new Vault(root)
    await v.init()
    const a = await v.create(null, 'A')
    const page = await v.read(a.id)
    const before = page.meta.updated
    await new Promise((r) => setTimeout(r, 5))
    const res = await v.write(a.id, { markdown: 'Merhaba **dünya**\n', meta: { ...page.meta, icon: '🧮' } })
    expect(res.updated > before).toBe(true)
    const again = await v.read(a.id)
    expect(again.markdown).toBe('Merhaba **dünya**\n')
    expect(again.meta.icon).toBe('🧮')
    expect(v.recentWrites.has(join(root, 'A.md'))).toBe(true)
  })

  it('trash dosyayı ve alt klasörü trashFn ile siler', async () => {
    const v = new Vault(root)
    await v.init()
    const a = await v.create(null, 'A')
    await v.create(a.id, 'B')
    const trashed: string[] = []
    await v.trash(a.id, async (p) => {
      trashed.push(p)
      rmSync(p, { recursive: true, force: true })
    })
    expect(trashed.sort()).toEqual([join(root, 'A'), join(root, 'A.md')].sort())
    expect(await v.tree()).toEqual([])
  })

  it('saveAttachment attachments klasörüne benzersiz adla yazar', async () => {
    const v = new Vault(root)
    await v.init()
    const rel = await v.saveAttachment(new Uint8Array([1, 2, 3]), 'png', 'Ekran Görüntüsü')
    expect(rel).toMatch(/^attachments\/Ekran Görüntüsü-[a-z0-9]{6}\.png$/)
    expect(readFileSync(join(root, rel))).toEqual(Buffer.from([1, 2, 3]))
  })
})

describe('settings', () => {
  it('varsayılanları döner ve yamayı derin birleştirir', async () => {
    expect(await readSettings(root)).toEqual(DEFAULT_SETTINGS)
    const s = await writeSettings(root, { theme: 'dark', paste: { ...DEFAULT_SETTINGS.paste, stripCitations: false } })
    expect(s.theme).toBe('dark')
    expect((await readSettings(root)).paste.stripCitations).toBe(false)
  })
})
