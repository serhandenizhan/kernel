export interface Shortcut {
  group: string
  keys: string
  action: string
  phase: 1 | 2 | 3
}

// Kısayol tablosu (spec §13). Faz 1 dışındakiler rehberde gösterilmez.
export const SHORTCUTS: Shortcut[] = [
  { group: 'Sayfalar', keys: '⌘N', action: 'Yeni sayfa', phase: 1 },
  { group: 'Sayfalar', keys: '⌘⇧N', action: 'Mevcut sayfanın altına alt sayfa', phase: 1 },
  { group: 'Sayfalar', keys: '⌘K', action: 'Ara / sayfaya git', phase: 1 },
  { group: 'Sayfalar', keys: '⌘E', action: 'PDF olarak dışa aktar', phase: 1 },
  { group: 'Görünüm', keys: '⌘\\', action: 'Kenar çubuğunu aç/kapat', phase: 1 },
  { group: 'Görünüm', keys: '⌘⇧T', action: 'İçindekiler panelini aç/kapat', phase: 1 },
  { group: 'Görünüm', keys: '⌘/', action: 'Kernel Rehberi', phase: 1 },
  { group: 'Görünüm', keys: '⌘,', action: 'Ayarlar', phase: 1 },
  { group: 'Yazma', keys: '⌘B', action: 'Kalın', phase: 1 },
  { group: 'Yazma', keys: '⌘I', action: 'İtalik', phase: 1 },
  { group: 'Yazma', keys: '⌘U', action: 'Altı çizili', phase: 1 },
  { group: 'Yazma', keys: '⌘⇧S', action: 'Üstü çizili', phase: 1 },
  { group: 'Yazma', keys: '⌘⇧M', action: 'Satır içi formül', phase: 1 },
  { group: 'Yazma', keys: '⌘⌥C', action: 'Kod bloğu', phase: 1 },
  { group: 'Yazma', keys: '/', action: 'Blok menüsü', phase: 1 },
  { group: 'Yazma', keys: '$$ + boşluk', action: 'Blok formül', phase: 1 },
  { group: 'Yapıştırma', keys: '⌘V', action: 'Akıllı yapıştırma (formül ve kod algılanır)', phase: 1 },
  { group: 'Yapıştırma', keys: '⌘Z', action: 'Yapıştırmadan hemen sonra: ham metne dön', phase: 1 },
  { group: 'Yapıştırma', keys: '⌘⇧V', action: 'Ham metin olarak yapıştır', phase: 1 },
  { group: 'Gezinme', keys: '⌘P', action: 'Komut paleti', phase: 3 },
  { group: 'Gezinme', keys: '⌘⇧F', action: 'Odak modu', phase: 3 },
  { group: 'Gezinme', keys: '⌘T', action: 'Yeni sekme', phase: 3 },
  { group: 'Gezinme', keys: '⌘W', action: 'Sekmeyi kapat', phase: 3 }
]
