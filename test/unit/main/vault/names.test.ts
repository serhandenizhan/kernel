import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sanitizeTitle, uniqueName } from '../../../../src/main/vault/names'

describe('sanitizeTitle', () => {
  it('macOS için yasak karakterleri benzerleriyle değiştirir', () => {
    expect(sanitizeTitle('Fizik / Lab: 1')).toBe('Fizik ∕ Lab꞉ 1')
  })
  it('boş başlığa Adsız verir', () => {
    expect(sanitizeTitle('   ')).toBe('Adsız')
  })
  it('baştaki noktayı kaldırır ve 120 karakterle sınırlar', () => {
    expect(sanitizeTitle('.gizli')).toBe('gizli')
    expect(sanitizeTitle('a'.repeat(200))).toHaveLength(120)
  })
  it('NFC döndürür', () => {
    expect(sanitizeTitle('Özet')).toBe('Özet')
  })
})

describe('uniqueName', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kernel-names-'))
    writeFileSync(join(dir, 'Fizik.md'), '')
  })
  it('büyük/küçük harf duyarsız çakışmada (2) ekler', async () => {
    expect(await uniqueName(dir, 'fizik', '.md')).toBe('fizik (2)')
  })
  it('çakışma yoksa adı korur', async () => {
    expect(await uniqueName(dir, 'Kimya', '.md')).toBe('Kimya')
  })
  it('büyük I harfi APFS gibi i ile çakışır (Türkçe ı dönüşümüne kanmaz)', async () => {
    writeFileSync(join(dir, 'introduction.md'), '')
    expect(await uniqueName(dir, 'Introduction', '.md')).toBe('Introduction (2)')
    expect(await uniqueName(dir, 'INTRODUCTION', '.md')).toBe('INTRODUCTION (2)')
  })
  it('taken kümesini de dikkate alır', async () => {
    expect(await uniqueName(dir, 'Kimya', '.md', new Set(['kimya.md']))).toBe('Kimya (2)')
  })
})
