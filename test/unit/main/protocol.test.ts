import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveVaultUrl } from '../../../src/main/protocol'

const root = mkdtempSync(join(tmpdir(), 'kernel-proto-'))
mkdirSync(join(root, 'attachments'))
writeFileSync(join(root, 'attachments', 'Ekran Görüntüsü ş.png'), 'x')

describe('resolveVaultUrl', () => {
  it('boşluk ve Türkçe karakterli yolu çözer', () => {
    expect(resolveVaultUrl(root, 'kernel-file://vault/attachments/Ekran%20G%C3%B6r%C3%BCnt%C3%BCs%C3%BC%20%C5%9F.png')).toBe(join(root, 'attachments/Ekran Görüntüsü ş.png'))
  })
  it('kasa dışına çıkışı reddeder', () => {
    expect(resolveVaultUrl(root, 'kernel-file://vault/../etc/passwd')).toBeNull()
    expect(resolveVaultUrl(root, 'kernel-file://vault/%2E%2E/%2E%2E/etc/passwd')).toBeNull()
    expect(resolveVaultUrl(root, 'kernel-file://vault/%2Fetc%2Fpasswd')).toBeNull()
    expect(resolveVaultUrl(root, 'kernel-file://other/attachments/x')).toBeNull()
  })
  it('kasa dışını gösteren sembolik linki reddeder', () => {
    symlinkSync('/etc', join(root, 'attachments', 'kacis'))
    expect(resolveVaultUrl(root, 'kernel-file://vault/attachments/kacis/hosts')).toBeNull()
  })
})
