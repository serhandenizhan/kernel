// Ana sayfa hesapları (saf; Electron/DOM yok)

const pad = (n: number) => String(n).padStart(2, '0')

/** Yerel tarih (saat dilimine göre), YYYY-AA-GG */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
