// Arama ve karşılaştırma için Türkçe metni sadeleştirir: büyük/küçük harf ve ı/i, ş/s, ğ/g, ç/c, ö/o, ü/u eşdeğer
const MAP: Record<string, string> = { ı: 'i', ş: 's', ğ: 'g', ç: 'c', ö: 'o', ü: 'u' }

export function normalizeTr(s: string): string {
  return s
    .normalize('NFC')
    .toLocaleLowerCase('tr')
    .replace(/[ışğçöü]/g, (c) => MAP[c] ?? c)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}
