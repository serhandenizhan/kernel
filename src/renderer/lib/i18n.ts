import type { Lang } from '@shared/types'
import { resolveLang, t, tn, type MessageKey } from '@shared/i18n'
import { useStore } from '../state/store'
import { keys } from './platform'

type Params = Record<string, string | number>

/** Geçerli arayüz dili (ayar + sistem dili) */
export function useLang(): Lang {
  const setting = useStore((s) => s.settings.language)
  const locale = useStore((s) => s.systemLocale)
  return resolveLang(setting, locale)
}

/** Bileşen içi çeviri; dil değişince bileşen yeniden çizilir */
export function useT(): (key: MessageKey, params?: Params) => string {
  const lang = useLang()
  return (key, params) => keys(t(lang, key, params))
}

/** Bileşen içi çoğul çeviri */
export function useTn(): (key: string, count: number, params?: Params) => string {
  const lang = useLang()
  return (key, count, params) => keys(tn(lang, key, count, params))
}

/** React dışı kod için (toast, komutlar): o anki dili okur */
export function currentLang(): Lang {
  const s = useStore.getState()
  return resolveLang(s.settings.language, s.systemLocale)
}
export const tNow = (key: MessageKey, params?: Params): string => keys(t(currentLang(), key, params))
export const tnNow = (key: string, count: number, params?: Params): string => keys(tn(currentLang(), key, count, params))
