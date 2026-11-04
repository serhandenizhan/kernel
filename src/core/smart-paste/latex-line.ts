// Ayraçsız LaTeX satırı sezgisi: satır büyük ölçüde LaTeX komutlarından oluşuyorsa formüldür

/** 0..1 arası güven puanı */
export function latexLineScore(line: string): number {
  const s = line.trim()
  if (!s || /^(?:[-*+]|\d+[.)]|#{1,6}|>|\|)\s/.test(s)) return 0
  const commands = s.match(/\\[a-zA-Z]+/g) ?? []
  if (!commands.length) return 0
  const nonSpace = s.replace(/\s/g, '').length
  let signal = commands.reduce((n, c) => n + c.length, 0)
  signal += (s.match(/[{}^_=]/g) ?? []).length
  // komut dışındaki, 2 harften uzun düz kelimeler düzyazı işaretidir
  const prose = s
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/\{[^{}]*\}/g, ' ')
    .split(/[^\p{L}]+/u)
    .filter((w) => w.length > 2).length
  return Math.max(0, Math.min(1, signal / nonSpace - prose * 0.15))
}

export const LATEX_LINE_BLOCK = 0.75
export const LATEX_LINE_SUGGEST = 0.4
