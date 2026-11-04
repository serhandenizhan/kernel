import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'
import { Vault } from '../../../src/main/vault/vault'
import { exportMarkdownZip, referencedAttachments } from '../../../src/main/export'

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
})
