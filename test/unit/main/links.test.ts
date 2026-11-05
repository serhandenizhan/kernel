import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Vault } from '../../../src/main/vault/vault'
import { LinkIndex, rewriteLinksAfterRelocate } from '../../../src/main/links'

let vault: Vault
let idx: LinkIndex

async function page(parent: string | null, title: string, markdown: string, tags?: string[]) {
  const node = await vault.create(parent, title)
  const meta = (await vault.read(node.id)).meta
  await vault.write(node.id, { markdown, meta: tags ? { ...meta, tags } : meta })
  return node.id
}

beforeEach(async () => {
  vault = new Vault(mkdtempSync(join(tmpdir(), 'kernel-links-')))
  await vault.init()
  idx = new LinkIndex()
})

describe('LinkIndex', () => {
  it('keeps serving the previous index while a rebuild is running', async () => {
    const target = await page(null, 'Hedef', '')
    const a = await page(null, 'Kaynak', '[[Hedef]]')
    await idx.build(vault)
    // okumalar yavaş: yeniden tarama sürerken sorgu gelir
    const read = vault.read.bind(vault)
    vault.read = async (id: string) => {
      await new Promise((r) => setTimeout(r, 30))
      return read(id)
    }
    const rebuild = idx.build(vault)
    await new Promise((r) => setTimeout(r, 15))
    expect(idx.backlinks(target).map((b) => b.id)).toEqual([a])
    await rebuild
    expect(idx.backlinks(target).map((b) => b.id)).toEqual([a])
  })

  it('lists backlinks with context and skips self links', async () => {
    const target = await page(null, 'Hedef', 'Kendine [[Hedef]] link.')
    const a = await page(null, 'Kaynak', 'Önce satır.\n\nBkz. [[hedef]] burada.')
    await idx.build(vault)
    expect(idx.backlinks(target)).toEqual([{ id: a, title: 'Kaynak', context: 'Bkz. hedef burada.' }])
  })

  it('resolves path-form links to the right page when titles collide', async () => {
    const d1 = await page(null, 'Ders1', '')
    const d2 = await page(null, 'Ders2', '')
    const n1 = await page(d1, 'Notlar', '')
    const n2 = await page(d2, 'Notlar', '')
    const src = await page(null, 'Kaynak', '[[Ders2/Notlar]]')
    await idx.build(vault)
    expect(idx.backlinks(n2).map((b) => b.id)).toEqual([src])
    expect(idx.backlinks(n1)).toEqual([])
  })

  it('builds graph edges and tag counts', async () => {
    const a = await page(null, 'A', '[[B]] [[Yok]] #vize', ['final'])
    const b = await page(null, 'B', '#Vize')
    await idx.build(vault)
    const g = idx.graph()
    expect(g.nodes.map((n) => n.id).sort()).toEqual([a, b].sort())
    expect(g.links).toEqual([{ source: a, target: b }])
    expect(idx.tags()).toEqual([
      { tag: 'vize', count: 2 },
      { tag: 'final', count: 1 }
    ])
    expect(idx.pagesWithTag('VİZE').map((p) => p.id).sort()).toEqual([a, b].sort())
  })

  it('updates and removes single pages', async () => {
    const t = await page(null, 'T', '')
    const s = await page(null, 'S', '[[T]]')
    await idx.build(vault)
    await vault.write(s, { markdown: 'yok', meta: (await vault.read(s)).meta })
    await idx.update(vault, s)
    expect(idx.backlinks(t)).toEqual([])
    idx.remove(t)
    expect(idx.graph().nodes.map((n) => n.id)).toEqual([s])
  })
})

describe('rewriteLinksAfterRelocate', () => {
  it('pins links to the existing page when a rename makes its title ambiguous (display text unchanged)', async () => {
    const d1 = await page(null, 'Ders1', '')
    const d2 = await page(null, 'Ders2', '')
    const notes = await page(d1, 'Notlar', '')
    const other = await page(d2, 'Taslak', '')
    const src = await page(null, 'Kaynak', 'Bkz. [[Notlar]] ve [[notlar|özet]]')
    const before = await vault.tree()
    await vault.rename(other, 'Notlar')
    const changed = await rewriteLinksAfterRelocate(vault, other, before)
    expect(changed).toEqual([src])
    expect((await vault.read(src)).markdown).toBe('Bkz. [[Ders1/Notlar|Notlar]] ve [[Ders1/Notlar|özet]]')
    idx = new LinkIndex()
    await idx.build(vault)
    expect(idx.backlinks(notes).map((b) => b.id)).toEqual([src])
  })

  it('pins links when a move makes a title ambiguous', async () => {
    const d1 = await page(null, 'Ders1', '')
    const notes = await page(d1, 'Notlar', '')
    const loose = await page(null, 'Arşiv', '')
    const second = await page(loose, 'Notlar', '')
    const src = await page(null, 'Kaynak', '[[Ders1/Notlar]] ve [[Arşiv/Notlar|arşiv]]')
    void notes
    const before = await vault.tree()
    await vault.move(second, null, 0)
    await rewriteLinksAfterRelocate(vault, second, before)
    // taşınan sayfanın linki yeni yoluna (kökte, ad çakışıyor) gider, diğeri dokunulmadan kalır
    expect((await vault.read(src)).markdown).toBe('[[Ders1/Notlar]] ve [[Notlar|arşiv]]')
  })

  it('rewrites title and path links that pointed to the renamed page', async () => {
    const d = await page(null, 'Ders', '')
    const t = await page(d, 'Eski', '')
    const s = await page(null, 'Kaynak', '[[Eski]] ve [[Ders/Eski|bak]]\n```\n[[Eski]]\n```')
    const before = await vault.tree()
    await vault.rename(t, 'Yeni')
    const changed = await rewriteLinksAfterRelocate(vault, t, before)
    expect(changed).toEqual([s])
    expect((await vault.read(s)).markdown).toBe('[[Yeni]] ve [[Yeni|bak]]\n```\n[[Eski]]\n```')
  })

  it('pins links to the same-titled other page and uses the path when the new title is ambiguous', async () => {
    const a = await page(null, 'A', '')
    const b = await page(null, 'B', '')
    const first = await page(a, 'Not', '')
    const second = await page(b, 'Eski', '')
    await page(null, 'Diğer', '')
    const s = await page(null, 'Kaynak', '[[Not]] [[Eski]]')
    const before = await vault.tree()
    await vault.rename(second, 'Not')
    await rewriteLinksAfterRelocate(vault, second, before)
    expect((await vault.read(s)).markdown).toBe('[[A/Not|Not]] [[B/Not]]')
    expect(first).toBeTruthy()
  })

  it('rewrites path-form links to descendants when a parent is renamed', async () => {
    const a = await page(null, 'A', '')
    await page(a, 'B', '')
    const s = await page(null, 'Kaynak', '[[A/B]] ve [[A]]')
    const before = await vault.tree()
    await vault.rename(a, 'Z')
    await rewriteLinksAfterRelocate(vault, a, before)
    expect((await vault.read(s)).markdown).toBe('[[B]] ve [[Z]]')
  })
})
