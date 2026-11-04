// Çit içine alınmamış kodu tanır: art arda ≥ 2 satırlık, güçlü kod sinyali taşıyan grupları ``` çitine alır.
// Dil burada belirlenmez; convertPaste etiketsiz çitlerin dilini sonradan tespit eder.

const STRUCTURE = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>|\|)/
const PLACEHOLDER = /\u0000/

function isCodeLine(line: string): boolean {
  const t = line.trim()
  if (!t || STRUCTURE.test(line) || PLACEHOLDER.test(line)) return false
  if (/[;{}]\s*$/.test(t) || /^\s*}/.test(t)) return true
  if (/^(?:#include\b|#define\b|import\s+[\w.{]|from\s+[\w.]+\s+import\b|def\s+\w+\s*\(|class\s+\w+[\s:(]|function\b|public\b|private\b|protected\b|static\b|return\b|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|int\s+\w+|void\s+\w+|for\s*\(|while\s*\(|if\s*\(|elif\b|else\s*:|try\s*:|except\b|print\s*\(|console\.\w+\(|SELECT\s|INSERT\s|UPDATE\s|CREATE\s)/.test(t)) return true
  return false
}

function isProse(line: string): boolean {
  const t = line.trim()
  const words = t.split(/\s+/).filter((w) => /^\p{L}{2,}[.,;:!?]?$/u.test(w))
  return /[.!?]$/.test(t) && words.length >= 4
}

export function detectUnfencedCode(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (!lines[i]!.trim()) {
      out.push(lines[i]!)
      i++
      continue
    }
    // boş olmayan satır grubunu topla
    let j = i
    while (j < lines.length && lines[j]!.trim()) j++
    const group = lines.slice(i, j)
    const codeLines = group.filter(isCodeLine).length
    const proseLines = group.filter(isProse).length
    if (group.length >= 2 && codeLines / group.length >= 0.6 && proseLines === 0) {
      out.push('```', ...group, '```')
    } else {
      out.push(...group)
    }
    i = j
  }
  return out.join('\n')
}
