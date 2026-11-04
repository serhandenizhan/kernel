// attachments/… yolunu kernel-file:// adresine çevirir; http(s), data: ve kernel-file: olduğu gibi kalır.
// Obsidian/Typora/Notion dışa aktarımları yolu zaten kodlanmış yazar (%20): önce bir kez çözülür, sonra kodlanır.
export function toVaultUrl(src: string): string {
  if (/^(https?:|data:|kernel-file:)/.test(src)) return src
  return `kernel-file://vault/${src
    .split('/')
    .map((part) => {
      let decoded = part
      try {
        decoded = decodeURIComponent(part)
      } catch {
        // geçersiz % dizisi: ad olduğu gibi kullanılır
      }
      return encodeURIComponent(decoded)
    })
    .join('/')}`
}
