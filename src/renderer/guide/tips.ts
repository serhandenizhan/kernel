import type { MessageKey } from '@shared/i18n'
import { create } from 'zustand'
import { useStore } from '../state/store'

export type TipId = 'first-paste' | 'first-math' | 'first-slash' | 'first-export' | 'first-history' | 'first-pin'

export const TIPS: Record<TipId, { title: MessageKey; body: MessageKey }> = {
  'first-paste': { title: 'tip.paste.title', body: 'tip.paste.body' },
  'first-math': { title: 'tip.math.title', body: 'tip.math.body' },
  'first-slash': { title: 'tip.slash.title', body: 'tip.slash.body' },
  'first-history': { title: 'tip.history.title', body: 'tip.history.body' },
  'first-export': { title: 'tip.export.title', body: 'tip.export.body' },
  'first-pin': { title: 'tip.pin.title', body: 'tip.pin.body' }
}

export const useTip = create<{ current: TipId | null }>(() => ({ current: null }))

/** İpucunu (açıksa ve daha önce görülmediyse) bir kez gösterir */
export function showTip(id: TipId): void {
  if (!(id in TIPS)) return
  const { settings, setSettings } = useStore.getState()
  if (!settings.tips.enabled || settings.tips.seen.includes(id)) return
  useTip.setState({ current: id })
  void setSettings({ tips: { ...settings.tips, seen: [...settings.tips.seen, id] } })
}

// Uygulamanın her yerinden "kernel:tip" olayıyla tetiklenebilir
window.addEventListener('kernel:tip', (e) => showTip((e as CustomEvent<TipId>).detail))
