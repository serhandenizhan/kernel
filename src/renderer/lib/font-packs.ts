import type { Settings } from '@shared/types'

// Yazı tipi paketleri: ayar seçicisinde önizleme için. Asıl yazı tipleri tokens.css'te [data-body-font] ile atanır.
export interface FontPack {
  id: Settings['bodyFont']
  /** paket adı (özel ad; çevrilmez) */
  name: string
  /** önizlemede adın yazıldığı başlık yazı tipi */
  preview: string
  previewWeight: number
  /** başlık + metin + kod yazı tiplerinin adları (özel adlar) */
  fonts: string
}

export const FONT_PACKS: FontPack[] = [
  { id: 'plex', name: 'IBM Plex', preview: "'Fraunces Variable', serif", previewWeight: 650, fonts: 'Fraunces + Plex Sans + Plex Mono' },
  { id: 'bricolage', name: 'Bricolage', preview: "'Bricolage Grotesque Variable', sans-serif", previewWeight: 800, fonts: 'Bricolage + Figtree + DM Mono' },
  { id: 'editorial', name: 'Editorial', preview: "'Instrument Serif', serif", previewWeight: 400, fonts: 'Instrument Serif + Inter + JetBrains Mono' },
  { id: 'space', name: 'Space', preview: "'Space Grotesk Variable', sans-serif", previewWeight: 700, fonts: 'Space Grotesk + Inter + Space Mono' },
  { id: 'book', name: 'Literata', preview: "'Literata Variable', serif", previewWeight: 600, fonts: 'Literata + Fira Code' },
  { id: 'rounded', name: 'Nunito', preview: "'Nunito Variable', sans-serif", previewWeight: 800, fonts: 'Nunito + JetBrains Mono' },
  { id: 'sans', name: 'SF Pro', preview: "-apple-system, 'Segoe UI', sans-serif", previewWeight: 700, fonts: 'SF Pro' },
  { id: 'serif', name: 'New York', preview: "ui-serif, 'New York', Georgia, serif", previewWeight: 700, fonts: 'New York + SF Pro' }
]
