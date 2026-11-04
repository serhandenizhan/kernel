import { create } from 'zustand'
import { useStore } from '../state/store'

export type TipId = 'first-paste' | 'first-math' | 'first-slash' | 'first-export'

export const TIPS: Record<TipId, { title: string; body: string }> = {
  'first-paste': { title: 'Akıllı yapıştırma', body: 'Formüller ve kod blokları otomatik algılandı. Ham metin istersen hemen ⌘Z, ya da ⌘⇧V ile ham yapıştır.' },
  'first-math': { title: 'Formül düzenleme', body: 'LaTeX yaz; yalnızca geçerli formül uygulanır. Bitirmek için ⌘↵ (satır içinde ↵).' },
  'first-slash': { title: 'Blok menüsü', body: 'Türkçe karakter yazmadan da arayabilirsin: "basl" → Başlık.' },
  'first-export': { title: 'PDF hazır', body: 'Alt sayfaları da tek PDF’te birleştirmek için export penceresindeki seçeneği kullan.' }
}

export const useTip = create<{ current: TipId | null }>(() => ({ current: null }))

/** İpucunu (açıksa ve daha önce görülmediyse) bir kez gösterir */
export function showTip(id: TipId): void {
  const { settings, setSettings } = useStore.getState()
  if (!settings.tips.enabled || settings.tips.seen.includes(id)) return
  useTip.setState({ current: id })
  void setSettings({ tips: { ...settings.tips, seen: [...settings.tips.seen, id] } })
}

// Uygulamanın her yerinden "kernel:tip" olayıyla tetiklenebilir
window.addEventListener('kernel:tip', (e) => showTip((e as CustomEvent<TipId>).detail))
