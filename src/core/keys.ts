// Kısayol etiketleri: metinler macOS simgeleriyle yazılır; Windows / Linux'ta okunur karşılıklarına çevrilir
const NAMES: Record<string, string> = { '⌘': 'Ctrl', '⇧': 'Shift', '⌥': 'Alt', '⌃': 'Ctrl' }

export function keyLabel(text: string, mac: boolean): string {
  if (mac) return text
  return text
    .replace(/[⌘⇧⌥⌃]+(?=\S)/g, (mods) => [...mods].map((m) => NAMES[m] + '+').join(''))
    .replace(/[⌘⇧⌥⌃]/g, (m) => NAMES[m]!)
    .replace(/↵/g, 'Enter')
}
