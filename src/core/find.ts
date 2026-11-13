import { normalizeTr } from './normalize-tr'

// Sayfa içi arama (⌘F): büyük/küçük harf ve Türkçe harflere duyarsız eşleşme.
// Her karakter tek karaktere indirgenir; böylece bulunan konumlar özgün metindeki konumlarla birebir aynıdır.
function fold(text: string): string {
  let out = ''
  for (const ch of text) {
    const f = normalizeTr(ch)
    // birden çok UTF-16 birimli karakterler (emoji) uzunluğu korumak için olduğu gibi kalır
    out += f.length === ch.length ? f : ch
  }
  return out
}

/** Metindeki eşleşmelerin [başlangıç, bitiş) konumları; örtüşenler sayılmaz */
export function findInText(text: string, query: string): [number, number][] {
  const q = fold(query)
  if (!q.trim()) return []
  const t = fold(text)
  const out: [number, number][] = []
  let i = t.indexOf(q)
  while (i !== -1) {
    out.push([i, i + q.length])
    i = t.indexOf(q, i + q.length)
  }
  return out
}
