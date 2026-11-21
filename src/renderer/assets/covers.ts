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
  { id: 'kernel:sand', label: 'cover.sand', css: 'radial-gradient(circle at 90% 10%, #f3e3c3 0 110px, transparent 111px), #e7d6b5' },
  { id: 'kernel:aurora', label: 'cover.aurora', css: 'linear-gradient(120deg, #0e7c6b 0%, #3b82a0 45%, #6d5bd0 100%)' },
  { id: 'kernel:dusk', label: 'cover.dusk', css: 'linear-gradient(160deg, #1f1c4a 0%, #7a4a9b 55%, #f08a6b 100%)' },
  { id: 'kernel:ocean', label: 'cover.ocean', css: 'linear-gradient(180deg, #a8dcf0 0%, #3a8fb7 55%, #134e6f 100%)' },
  { id: 'kernel:peach', label: 'cover.peach', css: 'linear-gradient(135deg, #ffd9c7, #ffb199 60%, #ff9a8b)' },
  { id: 'kernel:lavender', label: 'cover.lavender', css: 'linear-gradient(135deg, #e8defa, #c7b8f0 55%, #a79bea)' },
  { id: 'kernel:mint', label: 'cover.mint', css: 'linear-gradient(135deg, #dff6ec, #a8e6cf 60%, #7bd3b4)' },
  { id: 'kernel:graphite', label: 'cover.graphite', css: 'linear-gradient(135deg, #2b3238, #3d464e 60%, #586470)' },
  { id: 'kernel:rose', label: 'cover.rose', css: 'radial-gradient(circle at 20% 20%, #ffd6e0 0 100px, transparent 101px), radial-gradient(circle at 85% 90%, #f58aa5 0 140px, transparent 141px), #f6b6c8' },
  { id: 'kernel:citrus', label: 'cover.citrus', css: 'radial-gradient(circle at 80% 30%, #ffe27a 0 90px, transparent 91px), radial-gradient(circle at 15% 100%, #f5a623 0 150px, transparent 151px), #ffd36b' },
  { id: 'kernel:blueprint', label: 'cover.blueprint', css: 'repeating-linear-gradient(0deg, rgba(255,255,255,.18) 0 1px, transparent 1px 22px), repeating-linear-gradient(90deg, rgba(255,255,255,.18) 0 1px, transparent 1px 22px), #1e4fa3' },
  { id: 'kernel:dots', label: 'cover.dots', css: 'radial-gradient(rgba(14,124,107,.28) 1.5px, transparent 1.6px) 0 0 / 16px 16px, #f4f8f7' },
  { id: 'kernel:stripes', label: 'cover.stripes', css: 'repeating-linear-gradient(135deg, #e6edf2 0 14px, #f5f8fa 14px 28px)' },
  { id: 'kernel:sage', label: 'cover.sage', css: 'linear-gradient(135deg, #8fae9a, #6f9480)' },
  { id: 'kernel:clay', label: 'cover.clay', css: 'linear-gradient(135deg, #d9a58c, #b9775a)' },
  { id: 'kernel:midnight', label: 'cover.midnight', css: 'radial-gradient(circle at 70% 20%, #2f6fbe 0 60px, transparent 61px), linear-gradient(180deg, #0d1b36, #16305c)' },
  { id: 'kernel:sunset', label: 'cover.sunset', css: 'radial-gradient(circle at 10% 110%, #ff8a7a 0 160px, transparent 161px), radial-gradient(circle at 90% -10%, #ffc371 0 150px, transparent 151px), #ff6b6b' }
]

export function coverCss(cover: string | undefined, toUrl: (src: string) => string): string | null {
  if (!cover) return null
  const preset = COVER_PRESETS.find((p) => p.id === cover)
  if (preset) return preset.css
  const safe = toUrl(cover).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `url("${safe}") center / cover no-repeat`
}
