// Kısayol etiketleri: metinler macOS simgeleriyle yazılır; Windows / Linux'ta okunur karşılıklarına çevrilir
const NAMES: Record<string, string> = { '⌘': 'Ctrl', '⇧': 'Shift', '⌥': 'Alt', '⌃': 'Ctrl' }

export function keyLabel(text: string, mac: boolean): string {
  if (mac) return text
  return text
    .replace(/[⌘⇧⌥⌃]+(?=\S)/g, (mods) => [...mods].map((m) => NAMES[m] + '+').join(''))
    .replace(/[⌘⇧⌥⌃]/g, (m) => NAMES[m]!)
    .replace(/↵/g, 'Enter')
}

/** Kısayolun birincil değiştiricisi basılı mı: Mac'te ⌘, diğerlerinde Ctrl. Windows'ta AltGr = Ctrl+Alt sayılır; o zaman karakter yazılıyordur */
export function isModKey(e: { metaKey: boolean; ctrlKey: boolean; altKey: boolean }, mac: boolean): boolean {
  return mac ? e.metaKey : e.ctrlKey && !e.altKey
}
