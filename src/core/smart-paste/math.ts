// Ham metindeki formülleri Kernel'in kanonik biçimine çevirir: blok → $$…$$ (kendi satırlarında), satır içi → $…$
// Formül olmayan $ karakterleri \$ olarak kaçırılır. Metin kopyalanmadan, indeksle taranır (büyük yapıştırmalarda hızlı).

const ENVS = 'equation\\*?|align\\*?|aligned|gather\\*?|gathered|multline\\*?|split|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|array'
const BEGIN_RE = new RegExp(`\\\\begin\\{(${ENVS})\\}`, 'y')
const LIST_MARKER_ONLY = /^\s*(?:[-*+]|\d+[.)])\s*$/

interface Ctx {
  text: string
  out: string[]
  /** Çıktıda, mevcut satırın başlangıcından beri eklenen karakter sayısı */
}

function lineStart(text: string, i: number): number {
  return text.lastIndexOf('\n', i - 1) + 1
}
function lineEnd(text: string, i: number): number {
  const e = text.indexOf('\n', i)
  return e === -1 ? text.length : e
}

/** Satırın içerik girintisi: baştaki boşluklar + varsa liste işareti */
function contentIndent(line: string): string {
  const m = /^(\s*)(?:([-*+]|\d+[.)])\s+)?/.exec(line)
  if (!m) return ''
  return m[2] ? ' '.repeat(m[0].length) : (m[1] ?? '')
}

function dedent(s: string): string[] {
  const lines = s.replace(/^\s*\n|\n\s*$/g, '').split('\n')
  const widths = lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)![0].length)
  const min = widths.length ? Math.min(...widths) : 0
  return lines.map((l) => l.slice(min).trimEnd())
}

const oneLine = (s: string) => s.trim().replace(/\s*\n\s*/g, ' ')
const hasBlankLine = (text: string, from: number, to: number) => /\n[ \t]*\n/.test(text.slice(from, to))

export function extractMath(text: string): string {
  const out: string[] = []
  // çıktıdaki mevcut satırın, kaynaktaki satır başından itibaren kopyalanmış kısmı (blok yerleştirirken geri almak için)
  let lineBuf = ''
  const emit = (s: string) => {
    const nl = s.lastIndexOf('\n')
    lineBuf = nl === -1 ? lineBuf + s : s.slice(nl + 1)
    out.push(s)
  }
  const retractLine = () => {
    // son satırın çıktıya yazılmış kısmını geri al
    let remaining = lineBuf.length
    while (remaining > 0 && out.length) {
      const last = out[out.length - 1]!
      if (last.length <= remaining) {
        out.pop()
        remaining -= last.length
      } else {
        out[out.length - 1] = last.slice(0, last.length - remaining)
        remaining = 0
      }
    }
    lineBuf = ''
  }

  const block = (start: number, end: number, content: string): number => {
    const ls = lineStart(text, start)
    const line = text.slice(ls, lineEnd(text, start))
    // satırın çıktıya yazılmış (dönüştürülmüş) hali; formülden önceki metin kendi satırında kalır
    const before = lineBuf
    const indent = contentIndent(line)
    retractLine()
    const prefix = before.trim() ? before.trimEnd() : ''
    const body = dedent(content)
      .map((l) => (l ? indent + l : ''))
      .join('\n')
    emit(`${prefix}\n${prefix ? '\n' : ''}${indent}$$\n${body}\n${indent}$$\n`)
    const le = lineEnd(text, end)
    return text.slice(end, le).trim() ? end : le
  }

  const blockOrInline = (start: number, end: number, content: string): number => {
    const before = text.slice(lineStart(text, start), start)
    const after = text.slice(end, lineEnd(text, end))
    if ((!before.trim() || LIST_MARKER_ONLY.test(before)) && !after.trim()) return block(start, end, content)
    emit(`$${oneLine(content)}$`)
    return end
  }

  let i = 0
  let plainFrom = 0
  const flushPlain = (to: number) => {
    if (to > plainFrom) emit(text.slice(plainFrom, to))
  }

  while (i < text.length) {
    const ch = text.charCodeAt(i)
    // yalnızca '\' ve '$' ilgi çekici
    if (ch !== 92 /* \ */ && ch !== 36 /* $ */) {
      i++
      continue
    }
    let next = -1
    let handled = false
    flushPlain(i)
    if (text.startsWith('\\$', i)) {
      emit('\\$')
      next = i + 2
      handled = true
    } else if (ch === 92) {
      BEGIN_RE.lastIndex = i
      const env = BEGIN_RE.exec(text)
      if (env) {
        const endTag = `\\end{${env[1]}}`
        const end = text.indexOf(endTag, i)
        if (end !== -1) {
          next = block(i, end + endTag.length, text.slice(i, end + endTag.length))
          handled = true
        }
      }
      if (!handled && text.startsWith('\\[', i)) {
        const end = text.indexOf('\\]', i + 2)
        if (end > i + 2 && !hasBlankLine(text, i, end)) {
          next = blockOrInline(i, end + 2, text.slice(i + 2, end))
          handled = true
        }
      }
      if (!handled && text.startsWith('\\(', i)) {
        const end = text.indexOf('\\)', i + 2)
        if (end > i + 2 && !hasBlankLine(text, i, end)) {
          emit(`$${oneLine(text.slice(i + 2, end))}$`)
          next = end + 2
          handled = true
        }
      }
      if (!handled) {
        emit('\\')
        next = i + 1
        handled = true
      }
    } else if (text.startsWith('$$', i)) {
      const end = text.indexOf('$$', i + 2)
      if (end > i + 2) {
        next = blockOrInline(i, end + 2, text.slice(i + 2, end))
      } else {
        emit('\\$\\$')
        next = i + 2
      }
      handled = true
    } else {
      const m = inlineDollar(text, i)
      if (m !== null) {
        emit(`$${m}$`)
        next = i + m.length + 2
      } else {
        emit('\\$')
        next = i + 1
      }
      handled = true
    }
    i = next
    plainFrom = i
  }
  flushPlain(text.length)

  let result = out.join('').replace(/\n{3,}/g, '\n\n')
  if (!text.startsWith('\n')) result = result.replace(/^\n+/, '')
  if (!text.endsWith('\n')) result = result.replace(/\n+$/, '')
  return result
}

/** Pandoc kuralı: açılıştan sonra boşluk yok, kapanıştan önce boşluk yok, kapanıştan sonra rakam yok, aynı satır */
function inlineDollar(text: string, i: number): string | null {
  const next = text[i + 1]
  if (!next || /\s|\$/.test(next)) return null
  for (let j = i + 1; j < text.length; j++) {
    const ch = text[j]
    if (ch === '\n') return null
    if (ch === '$' && text[j - 1] !== '\\') {
      if (/\s/.test(text[j - 1]!) || /\d/.test(text[j + 1] ?? '')) return null
      return text.slice(i + 1, j)
    }
  }
  return null
}

export type { Ctx }
