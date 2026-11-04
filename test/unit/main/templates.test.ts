import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TemplateStore, formatDateTr } from '../../../src/main/templates'

let root: string
const now = () => new Date(2026, 10, 4, 10, 0)
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kernel-tpl-'))
})

describe('TemplateStore', () => {
  it('boşsa varsayılan "Ders notu" şablonunu oluşturur', async () => {
    const t = new TemplateStore(root, now)
    await t.ensureDefault()
    expect(await t.list()).toEqual(['Ders notu'])
  })
  it('değişkenleri doldurur', async () => {
    const t = new TemplateStore(root, now)
    await t.ensureDefault()
    const r = await t.render('Ders notu', 'Fizik 04.11.2026')
    expect(r.markdown).toContain('## Konu')
    expect(r.markdown).not.toContain('{{')
  })
  it('{{tarih}} GG.AA.YYYY biçimindedir', () => {
    expect(formatDateTr(new Date(2026, 10, 4))).toBe('04.11.2026')
  })
  it('sayfadan şablon kaydeder; aynı ad çakışmasız olur; ikon korunur', async () => {
    const t = new TemplateStore(root, now)
    const meta = { id: 'X', icon: '🧪', created: 'c', updated: 'u' }
    await t.saveFrom('# {{başlık}}\n\nTarih: {{tarih}}\n', meta, 'Laboratuvar')
    await t.saveFrom('başka', meta, 'Laboratuvar')
    expect((await t.list()).sort()).toEqual(['Laboratuvar', 'Laboratuvar (2)'])
    const r = await t.render('Laboratuvar', 'Deney 1')
    expect(r.markdown).toBe('# Deney 1\n\nTarih: 04.11.2026\n')
    expect(r.meta).toEqual({ icon: '🧪' })
  })
})
