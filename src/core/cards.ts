import { normalizeTr } from './normalize-tr'

export interface Card {
  id: string
  pageId: string
  question: string
  answer: string
}

/** FNV-1a 32 bit: kısa, kararlı özet */
function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Kart kimliği = sayfa id + normalize edilmiş sorunun özeti (spec §12); soru değişirse yeni kart olur */
export function cardId(pageId: string, question: string): string {
  const norm = normalizeTr(question)
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `${pageId}:${hash(norm)}`
}

const LINE = /^\s*(?:[-*+]\s+|\d+\.\s+)?(.+?)\s+::\s+(.+?)\s*$/
const CARD_TOGGLE = /<details\b[^>]*\bdata-card\b[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g

/** Sayfadaki kartlar: "Soru :: Cevap" satırları ve kart olarak işaretlenmiş toggle'lar (kod blokları hariç) */
export function extractCards(pageId: string, markdown: string): Card[] {
  const out: Card[] = []
  const add = (q: string, a: string) => {
    const question = q.trim()
    const answer = a.trim()
    if (question && answer) out.push({ id: cardId(pageId, question), pageId, question, answer })
  }
  let fence: string | null = null
  const prose: string[] = []
  for (const line of markdown.split('\n')) {
    const f = /^\s*(```+|~~~+)/.exec(line)
    if (f) {
      if (fence === null) fence = f[1]![0]!
      else if (f[1]![0] === fence) fence = null
      prose.push('')
      continue
    }
    if (fence !== null) {
      prose.push('')
      continue
    }
    prose.push(line)
    const m = LINE.exec(line)
    if (m) add(m[1]!, m[2]!)
  }
  for (const m of prose.join('\n').matchAll(CARD_TOGGLE)) add(m[1]!, m[2]!)
  return out
}
