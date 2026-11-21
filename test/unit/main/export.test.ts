import { describe, it, expect, beforeEach } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { unzipSync, strFromU8 } from 'fflate'
import { Vault } from '../../../src/main/vault/vault'
import { exportMarkdownZip, inlineAssetUrls, referencedAttachments } from '../../../src/main/export'

let root: string
let out: string
let vault: Vault
let fizikId: string

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'kernel-exp-'))
  out = mkdtempSync(join(tmpdir(), 'kernel-exp-out-'))
  vault = new Vault(root)
  await vault.init()
  writeFileSync(join(root, 'attachments', 'a b.png'), 'png')
  writeFileSync(join(root, 'attachments', 'kapak.jpg'), 'jpg')
  writeFileSync(join(root, 'attachments', 'kullanılmayan.png'), 'x')
  const f = await vault.create(null, 'Fizik')
  fizikId = f.id
  await vault.write(f.id, { markdown: '![şekil](<attachments/a b.png>)\n', meta: { ...(await vault.read(f.id)).meta, cover: 'attachments/kapak.jpg' } })
  const e = await vault.create(f.id, 'Ek')
  await vault.write(e.id, { markdown: 'ek sayfa\n', meta: (await vault.read(e.id)).meta })
})

describe('referencedAttachments', () => {
  it('görsel, gömülü pdf ve kodlanmış yolları bulur', () => {
    expect(referencedAttachments('![](attachments/Ekran%20G%C3%B6r.png) ![[attachments/s.pdf]] ![x](<attachments/a b.png>)').sort()).toEqual(['attachments/Ekran Gör.png', 'attachments/a b.png', 'attachments/s.pdf'])
  })
})

describe('exportMarkdownZip', () => {
  it('alt sayfalar ve kullanılan ekler dahil', async () => {
    const zip = await exportMarkdownZip(vault, fizikId, true, join(out, 'Fizik.zip'))
    const files = unzipSync(readFileSync(zip))
    expect(Object.keys(files).sort()).toEqual(['Fizik.md', 'Fizik/Ek.md', 'attachments/a b.png', 'attachments/kapak.jpg'])
    expect(strFromU8(files['Fizik.md']!)).toContain('cover: attachments/kapak.jpg')
  })
  it('alt sayfasız', async () => {
    const zip = await exportMarkdownZip(vault, fizikId, false, join(out, 'Fizik.zip'))
    expect(Object.keys(unzipSync(readFileSync(zip))).sort()).toEqual(['Fizik.md', 'attachments/a b.png', 'attachments/kapak.jpg'])
  })

  it('kasa dışına çıkan yolları (../, %2e%2e, symlink) zip içine almaz', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'kernel-exp-secret-'))
    const secret = join(outside, 'gizli.txt')
    writeFileSync(secret, 'COK_GIZLI')
    // kasa kökünün bir üstüne değil, doğrudan root/.. dışına çıkan göreli yol üret
    if (process.platform !== 'win32') symlinkSync(secret, join(root, 'attachments', 'kacis.txt'))
    const p = await vault.create(null, 'Saldiri')
    await vault.write(p.id, {
      markdown: `![](attachments/../../gizli.txt)\n![](attachments/%2e%2e/%2e%2e/${basename(outside)}/gizli.txt)\n![](attachments/kacis.txt)\n`,
      meta: (await vault.read(p.id)).meta
    })
    const zip = await exportMarkdownZip(vault, p.id, false, join(out, 'Saldiri.zip'))
    const entries = Object.keys(unzipSync(readFileSync(zip)))
    expect(entries).toEqual(['Saldiri.md'])
    expect(entries.some((k) => k.includes('..'))).toBe(false)
  })
})

describe('inlineAssetUrls', () => {
  it('yalnızca stil içindeki renderer varlıklarını gömer, not içeriğindeki url(...) ifadelerine dokunmaz', async () => {
    const rendererDir = mkdtempSync(join(tmpdir(), 'kernel-ren-'))
    mkdirSync(join(rendererDir, 'assets'))
    writeFileSync(join(rendererDir, 'assets', 'font.woff2'), 'FONT_DATA')
    const secretDir = mkdtempSync(join(tmpdir(), 'kernel-sec-'))
    const secretFile = join(secretDir, 'gizli.txt')
    writeFileSync(secretFile, 'GIZLI_BILGI')
    const html = `<style>.a{src:url("assets/font.woff2")}.b{src:url("../../${basename(secretDir)}/gizli.txt")}</style><body><pre>url("${pathToFileURL(secretFile).toString()}")</pre></body>`
    const outHtml = await inlineAssetUrls(html, rendererDir)
    expect(outHtml).toContain(`data:font/woff2;base64,${Buffer.from('FONT_DATA').toString('base64')}`)
    expect(outHtml).not.toContain(Buffer.from('GIZLI_BILGI').toString('base64'))
    expect(outHtml).toContain(pathToFileURL(secretFile).toString())
  })
})
