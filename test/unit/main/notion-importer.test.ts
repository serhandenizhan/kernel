import { describe, it, expect, beforeEach } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Vault } from '../../../src/main/vault/vault'
import { FixtureNotionClient, type FixtureData } from '../../../src/main/notion/fixture-client'
import { NotionImporter, type ImportProgress } from '../../../src/main/notion/importer'
import { resolveWikiTarget } from '../../../src/core/wiki'
import * as B from '../../fixtures/notion/builders'

const TODAY = () => new Date(2026, 10, 4, 12, 0)
const ROOT = 'Notion içe aktarım (2026-11-04)'

function fixture(): FixtureData {
  return {
    workspace: 'Test çalışma alanı',
    pages: [
      B.page('pg-root', 'Gezegenler', { emoji: '🪐' }),
      B.page('pg-mars', 'Mars', { parent: 'pg-root' }),
      B.page('pg-mars2', 'Mars', { parent: 'pg-root' }),
      B.page('pg-empty', ''),
      B.page('pg-slash', 'Hız/Zaman: notlar')
    ],
    blocks: {
      'pg-root': [B.para(B.t('Güneş sistemi')), B.childPage('pg-mars', 'Mars'), B.childPage('pg-mars2', 'Mars'), B.image('https://dosya/ok.png'), B.image('https://dosya/bozuk.png'), B.linkToPage('pg-mars2'), B.unsupported('ai_block')],
      'pg-mars': [B.para(B.t('Kızıl gezegen. Üst sayfa: '), B.mentionPage('pg-root', 'Gezegenler'))],
      'pg-mars2': [B.para(B.t('ikinci Mars'))],
      'pg-empty': [B.para(B.t('başlıksız'))],
      'pg-slash': [B.para(B.t('hız notları')), B.image('https://dosya/ok2.png')]
    }
  }
}

let vault: Vault
let progress: ImportProgress[]
beforeEach(async () => {
  vault = new Vault(mkdtempSync(join(tmpdir(), 'kernel-ni-')))
  await vault.init()
  progress = []
})

const download = (v: Vault) => async (url: string, hint: string) => (url.includes('bozuk') ? null : v.saveAttachment(new Uint8Array([1, 2, 3]), 'png', hint))
const make = (client: FixtureNotionClient, onProgress?: (p: ImportProgress, imp: NotionImporter) => void) => {
  const imp: NotionImporter = new NotionImporter({ client, vault, download: download(vault), today: TODAY, onProgress: (p) => (progress.push(p), onProgress?.(p, imp)) })
  return imp
}
const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)).map((f) => `${e.name}/${f}`) : e.name.endsWith('.md') ? [e.name] : []))

describe('NotionImporter', () => {
  it('ağacı aktarır: aynı adlı kardeşler, boş ve özel karakterli başlıklar, ikon, rapor', async () => {
    const report = await make(new FixtureNotionClient(fixture())).run(['pg-root', 'pg-empty', 'pg-slash'])
    const root = join(vault.root, ROOT)
    expect(files(root).sort()).toEqual(['Adsız.md', 'Gezegenler.md', 'Gezegenler/Mars (2).md', 'Gezegenler/Mars.md', 'Hız∕Zaman꞉ notlar.md', 'Notion aktarım raporu.md'].sort())
    expect(readFileSync(join(root, 'Gezegenler.md'), 'utf8')).toMatch(/icon: "?🪐"?/)
    expect(report.pages).toBe(5)
    expect(report.failedFiles).toEqual([{ page: 'Gezegenler', url: 'https://dosya/bozuk.png' }])
    expect(report.unsupported).toEqual([{ page: 'Gezegenler', type: 'ai_block' }])
    // indirilemeyen görsel orijinal adresiyle link olarak kalır (<url> otomatik link biçimi)
    expect(readFileSync(join(root, 'Gezegenler.md'), 'utf8')).toMatch(/<https:\/\/dosya\/bozuk\.png>|\]\(https:\/\/dosya\/bozuk\.png\)/)
    expect(readFileSync(join(root, 'Notion aktarım raporu.md'), 'utf8')).toContain('ai_block')
    expect(progress.at(-1)?.phase).toBe('done')
    expect(existsSync(join(vault.root, '.kernel', 'notion-import.json'))).toBe(false)
  })

  it('[[link]]ler doğru sayfaya gider (aynı adlı kardeşte yol kullanılır)', async () => {
    await make(new FixtureNotionClient(fixture())).run(['pg-root'])
    const root = join(vault.root, ROOT)
    const text = readFileSync(join(root, 'Gezegenler.md'), 'utf8')
    const targets = [...text.matchAll(/\[\[([^\]|]+)/g)].map((m) => m[1]!)
    const tree = await vault.tree()
    const ids = targets.map((t) => resolveWikiTarget(tree, t))
    const mars2 = (await vault.tree())[0]!.children[0]!.children.find((n) => n.title === 'Mars (2)')!.id
    expect(ids.filter((i) => i === mars2).length).toBe(2) // alt sayfa linki + link_to_page
    expect(readFileSync(join(root, 'Gezegenler', 'Mars.md'), 'utf8')).toContain('[[Gezegenler]]')
  })

  it('durdurulan aktarım kaldığı yerden devam eder, sayfa iki kez yazılmaz', async () => {
    const first = make(new FixtureNotionClient(fixture()), (p, imp) => p.phase === 'importing' && p.pagesDone === 1 && imp.cancel())
    await first.run(['pg-root', 'pg-slash'])
    expect(progress.at(-1)?.phase).toBe('canceled')
    expect(existsSync(join(vault.root, '.kernel', 'notion-import.json'))).toBe(true)
    const report = await make(new FixtureNotionClient(fixture())).resume()
    expect(report?.pages).toBe(4)
    expect(files(join(vault.root, ROOT)).filter((f) => f !== 'Notion aktarım raporu.md').length).toBe(4)
    expect(readFileSync(join(vault.root, ROOT, 'Gezegenler', 'Mars (2).md'), 'utf8')).toContain('ikinci Mars')
  })

  it('ağ kopunca reddeder; devam et eksikleri tamamlar', async () => {
    const client = new FixtureNotionClient(fixture())
    let failed = false
    client.failOn = (op, id) => (op === 'page' && id === 'pg-mars2' && !failed && (failed = true) ? 'network' : false)
    await expect(make(client).run(['pg-root'])).rejects.toThrow()
    expect(progress.at(-1)?.phase).toBe('error')
    const report = await make(new FixtureNotionClient(fixture())).resume()
    expect(report?.pages).toBe(3)
    expect(files(join(vault.root, ROOT)).length).toBe(4)
  })

  it('aynı gün ikinci aktarım ayrı klasöre gider, ilki değişmez', async () => {
    await make(new FixtureNotionClient(fixture())).run(['pg-slash'])
    const firstFile = join(vault.root, ROOT, 'Hız∕Zaman꞉ notlar.md')
    const mtime = statSync(firstFile).mtimeMs
    await make(new FixtureNotionClient(fixture())).run(['pg-slash'])
    expect(existsSync(join(vault.root, `${ROOT} (2)`, 'Hız∕Zaman꞉ notlar.md'))).toBe(true)
    expect(statSync(firstFile).mtimeMs).toBe(mtime)
  })

  it('toggle, sütun, callout ve senkron blok içindeki alt sayfalar da aktarılır', async () => {
    const data = fixture()
    data.pages.push(B.page('pg-inT', 'Toggle içi', { parent: 'pg-root' }), B.page('pg-inC', 'Sütun içi', { parent: 'pg-root' }))
    data.blocks['pg-root']!.push(B.toggle('Aç', [B.childPage('pg-inT', 'Toggle içi')]), B.columns([B.childPage('pg-inC', 'Sütun içi')], [B.para(B.t('sağ'))]))
    data.blocks['pg-inT'] = [B.para(B.t('gizli sayfa'))]
    data.blocks['pg-inC'] = [B.para(B.t('sütundaki sayfa'))]
    const report = await make(new FixtureNotionClient(data)).run(['pg-root'])
    const root = join(vault.root, ROOT)
    expect(files(root)).toEqual(expect.arrayContaining(['Gezegenler/Toggle içi.md', 'Gezegenler/Sütun içi.md']))
    expect(readFileSync(join(root, 'Gezegenler', 'Toggle içi.md'), 'utf8')).toContain('gizli sayfa')
    expect(report.pages).toBe(5)
  })

  it('devam sonrası rapor önceki sorunları korur, dosyalar ikinci kez indirilmez', async () => {
    // gerçek Notion'da olduğu gibi blok kimlikleri iki çalıştırmada aynı
    const data = fixture()
    await make(new FixtureNotionClient(data), (p, imp) => p.phase === 'importing' && p.pagesDone === 1 && imp.cancel()).run(['pg-root', 'pg-slash'])
    const report = await make(new FixtureNotionClient(data)).resume()
    expect(report?.failedFiles).toEqual([{ page: 'Gezegenler', url: 'https://dosya/bozuk.png' }])
    expect(report?.unsupported).toEqual([{ page: 'Gezegenler', type: 'ai_block' }])
    expect(report?.files).toBe(2)
    expect(readdirSync(join(vault.root, 'attachments')).filter((f) => f.startsWith('ok2-')).length).toBe(1)
    expect(readdirSync(join(vault.root, 'attachments')).filter((f) => f.startsWith('ok-')).length).toBe(1)
  })

  it('tek sayfadaki kalıcı hata aktarımı durdurmaz, rapora girer', async () => {
    const client = new FixtureNotionClient(fixture())
    client.failOn = (op, id) => (op === 'page' && id === 'pg-mars2' ? 'not_found' : false)
    const report = await make(client).run(['pg-root', 'pg-slash'])
    expect(report.failedPages).toEqual([{ page: 'Mars', error: 'Notion sayfası bulunamadı ya da integration ile paylaşılmamış' }])
    expect(files(join(vault.root, ROOT))).toEqual(expect.arrayContaining(['Gezegenler/Mars.md', 'Hız∕Zaman꞉ notlar.md']))
    expect(progress.at(-1)?.phase).toBe('done')
  })

  it('kök özetindeki rapor linki kendi aktarımının raporuna gider', async () => {
    await make(new FixtureNotionClient(fixture())).run(['pg-slash'])
    await make(new FixtureNotionClient(fixture())).run(['pg-slash'])
    const second = readFileSync(join(vault.root, `${ROOT} (2).md`), 'utf8')
    expect(second).toContain(`[[${ROOT} (2)/Notion aktarım raporu]]`)
  })
  it('ilk denemede inemeyen dosya bir kez daha denenir', async () => {
    const tries = new Map<string, number>()
    const flaky = async (url: string, hint: string) => {
      tries.set(url, (tries.get(url) ?? 0) + 1)
      return url.includes('bozuk') || tries.get(url) === 1 ? null : vault.saveAttachment(new Uint8Array([1]), 'png', hint)
    }
    const report = await new NotionImporter({ client: new FixtureNotionClient(fixture()), vault, download: flaky, today: TODAY, onProgress: () => {} }).run(['pg-root'])
    expect(tries.get('https://dosya/ok.png')).toBe(2)
    expect(report.files).toBe(1)
    expect(report.failedFiles).toEqual([{ page: 'Gezegenler', url: 'https://dosya/bozuk.png' }])
  })
  it('raporda süreli imzalı linkin geçici anahtarları yazılmaz', async () => {
    const signed = 'https://prod-files-secure.s3.us-west-2.amazonaws.com/ws/blk/gorsel.png?X-Amz-Algorithm=AWS4&X-Amz-Security-Token=GIZLI&X-Amz-Signature=abc'
    const data = fixture()
    data.blocks['pg-root'] = [B.image(signed.replace('gorsel', 'bozuk'))]
    const report = await make(new FixtureNotionClient(data)).run(['pg-root'])
    expect(report.failedFiles).toEqual([{ page: 'Gezegenler', url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/ws/blk/bozuk.png' }])
    expect(readFileSync(join(vault.root, ROOT, 'Notion aktarım raporu.md'), 'utf8')).not.toContain('GIZLI')
  })
  it('rapor ve kök klasör oluşturulduğu dilde yazılır (İngilizce)', async () => {
    const imp = new NotionImporter({ client: new FixtureNotionClient(fixture()), vault, download: download(vault), today: TODAY, onProgress: () => {}, lang: 'en' })
    await imp.run(['pg-root'])
    const root = join(vault.root, 'Notion import (2026-11-04)')
    const report = readFileSync(join(root, 'Notion import report.md'), 'utf8')
    expect(report).toContain('## Summary')
    expect(report).toContain('- Pages: 3')
    expect(report).not.toContain('Özet')
  })
})
