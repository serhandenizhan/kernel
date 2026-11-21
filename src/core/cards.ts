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

/** Eski kart kimliği (yalnızca harf, rakam ve boşluk bırakır); mevcut ilerlemeyi korumak için tutulur */
export function legacyCardId(pageId: string, question: string): string {
  const norm = normalizeTr(question)
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `${pageId}:${hash(norm)}`
}

const MATH_OR_OP = /[$+=*^_<>~%&|\\]|(?<=\s|\d)[-/](?=\s|\d)/

/** Kart kimliği = sayfa id + normalize edilmiş sorunun özeti (spec §12); matematik/işlem içeren sorularda işaretler de korunur */
export function cardId(pageId: string, question: string): string {
  if (!MATH_OR_OP.test(question)) return legacyCardId(pageId, question)
  const norm = normalizeTr(question)
    .replace(/[^\p{L}\p{N}\s+\-=*/^_<>!~%&|\\]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `${pageId}:${hash(norm)}`
}

const LINE = /^\s*(?:[-*+]\s+|\d+\.\s+)?(.+?)\s+::\s+(.+?)\s*$/
const TABLE_ROW = /^\s*\|.*\|\s*$/
const DETAILS_TAG = /<\/?details\b[^>]*>/gi
const CARD_TOGGLE = /<details\b[^>]*\bdata-card\b[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*)<\/details>\s*$/i
const FENCE_LINE = /^\s*(`{3,}|~{3,})(.*)$/

function updateFence(fence: { ch: string; len: number } | null, line: string): { fence: { ch: string; len: number } | null; toggled: boolean } {
  const f = FENCE_LINE.exec(line)
  if (!f) return { fence, toggled: false }
  const ch = f[1]![0]!
  const len = f[1]!.length
  const rest = f[2] ?? ''
  if (fence === null) {
    // CommonMark: backtick çitinin bilgi satırında backtick bulunamaz
    if (ch === '`' && rest.includes('`')) return { fence: null, toggled: false }
    return { fence: { ch, len }, toggled: true }
  }
  if (ch === fence.ch && len >= fence.len && !rest.trim()) return { fence: null, toggled: true }
  return { fence, toggled: false }
}

/** Sayfadaki kartlar: "Soru :: Cevap" satırları ve kart olarak işaretlenmiş toggle'lar (kod blokları ve tablo satırları hariç) */
export function extractCards(pageId: string, markdown: string): Card[] {
  const out: Card[] = []
  const add = (q: string, a: string) => {
    const question = q.trim()
    const answer = a.trim()
    if (question && answer) out.push({ id: cardId(pageId, question), pageId, question, answer })
  }
  let fence: { ch: string; len: number } | null = null
  let cardBuf: string[] | null = null
  let cardDepth = 0
  let cardFence: { ch: string; len: number } | null = null

  for (const line of markdown.split('\n')) {
    if (cardBuf !== null) {
      cardBuf.push(line)
      const cf = updateFence(cardFence, line)
      cardFence = cf.fence
      if (cardFence === null && !cf.toggled) {
        DETAILS_TAG.lastIndex = 0
        for (let m = DETAILS_TAG.exec(line); m; m = DETAILS_TAG.exec(line)) cardDepth += m[0].startsWith('</') ? -1 : 1
      }
      if (cardDepth <= 0) {
        const m = CARD_TOGGLE.exec(cardBuf.join('\n'))
        if (m) add(m[1]!, m[2]!)
        cardBuf = null
        cardDepth = 0
        cardFence = null
      }
      continue
    }

    const tf = updateFence(fence, line)
    if (tf.toggled || tf.fence !== null) {
      fence = tf.fence
      continue
    }

    if (/<details\b[^>]*\bdata-card\b/i.test(line)) {
      let depth = 0
      DETAILS_TAG.lastIndex = 0
      for (let m = DETAILS_TAG.exec(line); m; m = DETAILS_TAG.exec(line)) depth += m[0].startsWith('</') ? -1 : 1
      if (depth <= 0) {
        const m = CARD_TOGGLE.exec(line)
        if (m) add(m[1]!, m[2]!)
      } else {
        cardBuf = [line]
        cardDepth = depth
      }
      continue
    }

    if (TABLE_ROW.test(line)) continue
    const m = LINE.exec(line)
    if (m) add(m[1]!, m[2]!)
  }
  return out
}

export interface CardLineParts { qFrom: number; qTo: number; sepFrom: number; sepTo: number; aFrom: number; aTo: number }

/** Editörde vurgulamak için "Soru :: Cevap" satırının parçalarının konumları; kart değilse null */
export function cardLineSplit(line: string): CardLineParts | null {
  const m = /^(\s*(?:[-*+]\s+|\d+\.\s+)?)(.+?)(\s+::\s+)(.+?)\s*$/.exec(line)
  if (!m || !m[2]!.trim() || !m[4]!.trim()) return null
  const qFrom = m[1]!.length
  const qTo = qFrom + m[2]!.length
  const sepTo = qTo + m[3]!.length
  return { qFrom, qTo, sepFrom: qTo, sepTo, aFrom: sepTo, aTo: sepTo + m[4]!.length }
}
