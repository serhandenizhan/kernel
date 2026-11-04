import { describe, it, expect } from 'vitest'
import { toVaultUrl } from '@core/vault-url'

describe('toVaultUrl', () => {
  it('boşluk ve Türkçe karakterleri kodlar', () => {
    expect(toVaultUrl('attachments/a b ş.png')).toBe('kernel-file://vault/attachments/a%20b%20%C5%9F.png')
  })
  it('zaten kodlanmış yolu iki kez kodlamaz (Obsidian/Typora/Notion dışa aktarımları)', () => {
    expect(toVaultUrl('attachments/Ekran%20G%C3%B6r%C3%BCnt%C3%BCs%C3%BC.png')).toBe('kernel-file://vault/attachments/Ekran%20G%C3%B6r%C3%BCnt%C3%BCs%C3%BC.png')
  })
  it('% içeren ama geçerli kodlama olmayan adları korur', () => {
    expect(toVaultUrl('attachments/%zz başarı.png')).toBe('kernel-file://vault/attachments/%25zz%20ba%C5%9Far%C4%B1.png')
  })
  it('http, data ve kernel-file adreslerine dokunmaz', () => {
    expect(toVaultUrl('https://x.y/a.png')).toBe('https://x.y/a.png')
    expect(toVaultUrl('data:image/png;base64,AA')).toBe('data:image/png;base64,AA')
  })
})
