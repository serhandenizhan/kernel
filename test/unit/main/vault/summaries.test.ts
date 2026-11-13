import { describe, it, expect } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Vault } from '../../../../src/main/vault/vault'
import { computeHome } from '../../../../src/core/home'

describe('Vault.summaries', () => {
  it('ağaç sırasıyla; kapak, oluşturma, düzenleme ve alt sayfa sayısı', async () => {
    const root = mkdtempSync(join(tmpdir(), 'kernel-sum-'))
    writeFileSync(join(root, 'Gezegenler.md'), '---\nicon: "🪐"\ncover: "kernel:night"\ncreated: "2026-10-01T10:00:00.000Z"\nupdated: "2026-11-01T10:00:00.000Z"\n---\nGüneş.\n')
    mkdirSync(join(root, 'Gezegenler'))
    writeFileSync(join(root, 'Gezegenler', 'Mars.md'), '---\nupdated: "2026-11-05T09:00:00.000Z"\n---\nKızıl.\n')
    writeFileSync(join(root, 'Gezegenler', 'Venüs.md'), 'Sıcak.\n')
    const v = new Vault(root)
    await v.init()
    const s = await v.summaries()
    const g = s.find((p) => p.title === 'Gezegenler')!
    expect(g).toMatchObject({ icon: '🪐', cover: 'kernel:night', created: '2026-10-01T10:00:00.000Z', updated: '2026-11-01T10:00:00.000Z', childCount: 2, parentId: null })
    const mars = s.find((p) => p.title === 'Mars')!
    expect(mars).toMatchObject({ parentId: g.id, updated: '2026-11-05T09:00:00.000Z', childCount: 0, path: 'Gezegenler/Mars.md' })
    expect(s.map((p) => p.title)).toEqual(['Gezegenler', 'Mars', 'Venüs'])
  })
  it('geçersiz tarihler atılır, geçerliler ISO biçimine çevrilir', async () => {
    const root = mkdtempSync(join(tmpdir(), 'kernel-sum-'))
    writeFileSync(join(root, 'Obsidian.md'), '---\ncreated: "<% tp.file.creation_date() %>"\nupdated: "{{date}}"\n---\nx\n')
    writeFileSync(join(root, 'Tarih.md'), '---\ncreated: 2026-10-01\n---\ny\n')
    const v = new Vault(root)
    await v.init()
    const s = await v.summaries()
    const o = s.find((p) => p.title === 'Obsidian')!
    expect(o.created).toBeUndefined()
    expect(o.updated).toBeUndefined()
    expect(s.find((p) => p.title === 'Tarih')!.created).toBe('2026-10-01T00:00:00.000Z')
  })
  // süre ölçümü geliştirme makinesi (macOS) içindir; CI'nın Windows diski çok daha yavaş
  it.skipIf(process.platform === 'win32')('500 sayfada summaries + computeHome 200 ms altında (ısınmış önbellek)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'kernel-perf-'))
    for (let c = 0; c < 50; c++) {
      writeFileSync(join(root, `Ders ${c}.md`), `---\nupdated: "2026-11-0${(c % 5) + 1}T10:00:00.000Z"\n---\nDers ${c}\n`)
      mkdirSync(join(root, `Ders ${c}`))
      for (let k = 0; k < 9; k++) writeFileSync(join(root, `Ders ${c}`, `Konu ${k}.md`), `---\ncreated: "2026-10-1${k}T10:00:00.000Z"\n---\nKonu ${k}\n`)
    }
    const v = new Vault(root)
    await v.init()
    await v.summaries()
    const t0 = performance.now()
    const s = await v.summaries()
    computeHome(s, [], {}, '2026-11-05')
    expect(s).toHaveLength(500)
    expect(performance.now() - t0).toBeLessThan(200)
    // ölçülen yalnızca ısınmış çağrı; 500 dosyalık hazırlık yoğun makinede 5 sn varsayılanını aşabiliyor
  }, 30_000)
})
