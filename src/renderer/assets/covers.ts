import type { MessageKey } from '@shared/i18n'
// Hazır kapaklar (Ada paleti). PDF de aynı CSS'i kullanır.
export interface CoverPreset {
  id: string
  /** sözlük anahtarı */
  label: MessageKey
  css: string
}

export const COVER_PRESETS: CoverPreset[] = [
  { id: 'kernel:teal-waves', label: 'cover.tealWaves', css: 'radial-gradient(circle at 85% 120%, #5fc3b0 0 120px, transparent 121px), radial-gradient(circle at 12% -40%, #3fa493 0 140px, transparent 141px), #0e7c6b' },
  { id: 'kernel:mist', label: 'cover.mist', css: 'radial-gradient(circle at 20% 30%, #ffffff 0 90px, transparent 91px), radial-gradient(circle at 80% 80%, #c9d6e0 0 120px, transparent 121px), #dce5ec' },
  { id: 'kernel:night', label: 'cover.night', css: 'radial-gradient(circle at 75% 35%, #5546b5 0 70px, transparent 71px), radial-gradient(circle at 25% 110%, #3e3290 0 150px, transparent 151px), #1d1a3f' },
  { id: 'kernel:sunrise', label: 'cover.sunrise', css: 'radial-gradient(circle at 50% 130%, #ffd27a 0 150px, transparent 151px), radial-gradient(circle at 50% 130%, #f59e6b 0 230px, transparent 231px), #f6c6a8' },
  { id: 'kernel:forest', label: 'cover.forest', css: 'radial-gradient(circle at 15% 100%, #2f5d4a 0 130px, transparent 131px), radial-gradient(circle at 70% 120%, #3c6e57 0 160px, transparent 161px), #9cc5a8' },
  { id: 'kernel:paper', label: 'cover.paper', css: 'repeating-linear-gradient(0deg, rgba(14,124,107,.12) 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, rgba(14,124,107,.12) 0 1px, transparent 1px 18px), #f7faf9' },
  { id: 'kernel:ink', label: 'cover.ink', css: '#23408e' },
  { id: 'kernel:sand', label: 'cover.sand', css: 'radial-gradient(circle at 90% 10%, #f3e3c3 0 110px, transparent 111px), #e7d6b5' }
]

export function coverCss(cover: string | undefined, toUrl: (src: string) => string): string | null {
  if (!cover) return null
  const preset = COVER_PRESETS.find((p) => p.id === cover)
  if (preset) return preset.css
  return `url("${toUrl(cover)}") center / cover no-repeat`
}
