import { app } from 'electron'
import type { Lang } from '@shared/types'
import { resolveLang, t, tn, type MessageKey } from '@shared/i18n'

// Ana süreç dili: kasa açılınca ve ayar değişince güncellenir
let setting: Lang | 'system' = 'system'
const listeners = new Set<(lang: Lang) => void>()

export function setMainLanguage(next: Lang | 'system'): void {
  const before = mainLang()
  setting = next
  const after = mainLang()
  if (after !== before) for (const l of listeners) l(after)
}

/** Geçerli arayüz dili (ayar + macOS dili) */
export function mainLang(): Lang {
  return resolveLang(setting, app.getLocale())
}

/** Dil değişince çağrılır (örn. uygulama menüsünü yeniden kurmak için) */
export function onMainLanguageChange(cb: (lang: Lang) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export const mainT = (key: MessageKey, params?: Record<string, string | number>): string => t(mainLang(), key, params)
export const mainTn = (key: string, count: number, params?: Record<string, string | number>): string => tn(mainLang(), key, count, params)
