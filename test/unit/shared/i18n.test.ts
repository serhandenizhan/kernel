import { describe, it, expect } from 'vitest'
import { t, tn, resolveLang, formatRelative, formatLongDate, type MessageKey } from '@shared/i18n'
import { tr } from '@shared/i18n/tr'
import { en } from '@shared/i18n/en'
import { de } from '@shared/i18n/de'

describe('sözlükler', () => {
  it('üç dilin anahtar kümeleri aynı ve boş çeviri yok', () => {
    const keys = Object.keys(tr).sort()
    expect(Object.keys(en).sort()).toEqual(keys)
    expect(Object.keys(de).sort()).toEqual(keys)
    for (const d of [tr, en, de]) for (const v of Object.values(d)) expect(v.trim()).not.toBe('')
  })
  it('yer tutucular her dilde aynı', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
    for (const k of Object.keys(tr) as MessageKey[]) {
      expect(ph(en[k]), k).toBe(ph(tr[k]))
      expect(ph(de[k]), k).toBe(ph(tr[k]))
    }
  })
})

describe('çeviri fonksiyonları', () => {
  it('t ve tn', () => {
    expect(t('tr', 'common.subpages.other', { count: 5 })).toBe('5 alt sayfa')
    expect(tn('en', 'common.subpages', 1)).toBe('1 subpage')
    expect(tn('de', 'common.subpages', 3)).toBe('3 Unterseiten')
  })
  it('resolveLang', () => {
    expect(resolveLang('system', 'de-AT')).toBe('de')
    expect(resolveLang('system', 'fr-FR')).toBe('tr')
    expect(resolveLang('en', 'tr-TR')).toBe('en')
  })
  it('tarih biçimleri', () => {
    const now = new Date(2026, 10, 5, 18, 0)
    expect(formatLongDate(now, 'tr')).toBe('Perşembe, 5 Kasım 2026')
    expect(formatRelative(new Date(2026, 10, 5, 16, 0), now, 'tr')).toBe('2 saat önce')
    expect(formatRelative(new Date(2026, 10, 4, 12, 0), now, 'tr')).toBe('dün')
    expect(formatRelative(new Date(2026, 10, 4, 12, 0), now, 'en')).toBe('yesterday')
  })
})
