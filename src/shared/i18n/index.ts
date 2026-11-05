import type { Lang } from '../types'
import { tr } from './tr'
import { en } from './en'
import { de } from './de'

export type MessageKey = keyof typeof tr
type Params = Record<string, string | number>

const DICTS: Record<Lang, Record<MessageKey, string>> = { tr, en, de }
const LOCALES: Record<Lang, string> = { tr: 'tr-TR', en: 'en-US', de: 'de-DE' }

/** Dilin Intl yerel ayarı */
export const localeOf = (lang: Lang): string => LOCALES[lang]

const fill = (s: string, params?: Params) => (params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s)

/** Çeviri; eksik çeviri Türkçeye düşer */
export function t(lang: Lang, key: MessageKey, params?: Params): string {
  return fill(DICTS[lang][key] ?? tr[key] ?? key, params)
}

/** Çoğul çeviri: `key.one` / `key.other` anahtarlarından Intl.PluralRules ile seçer */
export function tn(lang: Lang, key: string, count: number, params?: Params): string {
  const form = new Intl.PluralRules(LOCALES[lang]).select(count) === 'one' ? 'one' : 'other'
  return t(lang, `${key}.${form}` as MessageKey, { count, ...params })
}

/** Ayar + sistem dili → arayüz dili (desteklenmeyen sistem dili Türkçeye düşer) */
export function resolveLang(setting: Lang | 'system', systemLocale: string): Lang {
  if (setting !== 'system') return setting
  const base = systemLocale.toLowerCase().split(/[-_]/)[0]
  return base === 'en' || base === 'de' || base === 'tr' ? base : 'tr'
}

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Göreli zaman: "2 saat önce", "dün", "3 gün önce", "geçen hafta"… */
export function formatRelative(date: Date, now: Date, lang: Lang): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: 'auto' })
  const days = Math.round((startOfDay(now) - startOfDay(date)) / DAY)
  if (days <= 0) {
    const mins = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000))
    if (mins < 1) return rtf.format(0, 'second')
    if (mins < 60) return rtf.format(-mins, 'minute')
    return rtf.format(-Math.round(mins / 60), 'hour')
  }
  if (days < 7) return rtf.format(-days, 'day')
  if (days < 30) return rtf.format(-Math.round(days / 7), 'week')
  if (days < 365) return rtf.format(-Math.round(days / 30), 'month')
  return rtf.format(-Math.round(days / 365), 'year')
}

/** Uzun tarih: "Perşembe, 5 Kasım 2026" / "Thursday, November 5, 2026" / "Donnerstag, 5. November 2026" */
export function formatLongDate(date: Date, lang: Lang): string {
  const loc = LOCALES[lang]
  const weekday = new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(date)
  const rest = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  return `${weekday}, ${rest}`
}

/** Adsız sayfa adları (her dilde): başlık alanı bunları boş gösterir */
export function isUntitled(title: string): boolean {
  return title === tr['page.untitled'] || title === en['page.untitled'] || title === de['page.untitled']
}
