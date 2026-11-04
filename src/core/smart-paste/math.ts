// Ham metindeki formülleri Kernel'in kanonik biçimine çevirir: blok → $$…$$ (kendi satırlarında), satır içi → $…$
// Formül olmayan $ karakterleri \$ olarak kaçırılır.

const ENVS = 'equation\\*?|align\\*?|aligned|gather\\*?|gathered|multline\\*?|split|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|array'
const BEGIN_RE = new RegExp(`^\\\\begin\\{(${ENVS})\\}`)
const LIST_MARKER_ONLY = /^\s*(?:[-*+]|\d+[.)])\s*$/

interface Ctx {
  text: string
  out: string
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

export function extractMath(text: string): string {
  const ctx: Ctx = { text, out: '' }
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    // zaten kaçırılmış dolar
    if (rest.startsWith('\\$')) {
      ctx.out += '\\$'
      i += 2
      continue
    }
    const env = BEGIN_RE.exec(rest)
    if (env) {
      const endTag = `\\end{${env[1]}}`
      const end = rest.indexOf(endTag)
      if (end !== -1) {
        i = emitBlock(ctx, i, i + end + endTag.length, rest.slice(0, end + endTag.length))
        continue
      }
    }
    if (rest.startsWith('$$')) {
      const end = rest.indexOf('$$', 2)
      if (end > 2) {
        i = emitBlockOrInline(ctx, i, i + end + 2, rest.slice(2, end))
        continue
      }
    }
    if (rest.startsWith('\\[')) {
      const end = rest.indexOf('\\]', 2)
      if (end > 2 && !/\n\s*\n/.test(rest.slice(2, end))) {
        i = emitBlockOrInline(ctx, i, i + end + 2, rest.slice(2, end))
        continue
      }
    }
    if (rest.startsWith('\\(')) {
      const end = rest.indexOf('\\)', 2)
      if (end > 2 && !/\n\s*\n/.test(rest.slice(2, end))) {
        ctx.out += `$${oneLine(rest.slice(2, end))}$`
        i += end + 2
        continue
      }
    }
    if (rest[0] === '$') {
      const m = inlineDollar(rest)
      if (m !== null) {
        ctx.out += `$${m}$`
        i += m.length + 2
      } else {
        ctx.out += '\\$'
        i += 1
      }
      continue
    }
    ctx.out += text[i]
    i++
  }
  let out = ctx.out.replace(/\n{3,}/g, '\n\n')
  if (!text.startsWith('\n')) out = out.replace(/^\n+/, '')
  if (!text.endsWith('\n')) out = out.replace(/\n+$/, '')
  return out
}

/** Pandoc kuralı: açılıştan sonra boşluk yok, kapanıştan önce boşluk yok, kapanıştan sonra rakam yok, aynı satır */
function inlineDollar(rest: string): string | null {
  const next = rest[1]
  if (!next || /\s|\$/.test(next)) return null
  for (let j = 1; j < rest.length; j++) {
    const ch = rest[j]
    if (ch === '\n') return null
    if (ch === '$' && rest[j - 1] !== '\\') {
      if (/\s/.test(rest[j - 1]!) || /\d/.test(rest[j + 1] ?? '')) return null
      return rest.slice(1, j)
    }
  }
  return null
}

/** Kendi satırında duran formül blok olur; satır ortasındaki satır içi kalır */
function emitBlockOrInline(ctx: Ctx, start: number, end: number, content: string): number {
  const before = ctx.text.slice(lineStart(ctx.text, start), start)
  const after = ctx.text.slice(end, lineEnd(ctx.text, end))
  const alone = (!before.trim() || LIST_MARKER_ONLY.test(before)) && !after.trim()
  if (alone) return emitBlock(ctx, start, end, content)
  ctx.out += `$${oneLine(content)}$`
  return end
}

function emitBlock(ctx: Ctx, start: number, end: number, content: string): number {
  const ls = lineStart(ctx.text, start)
  const line = ctx.text.slice(ls, lineEnd(ctx.text, start))
  const before = ctx.text.slice(ls, start)
  const indent = contentIndent(line)
  // bu satırın formülden önceki kısmını çıktıdan geri al ve yeniden yerleştir
  ctx.out = ctx.out.slice(0, ctx.out.length - before.length)
  let prefix = ''
  if (LIST_MARKER_ONLY.test(before)) prefix = before.trimEnd()
  else if (before.trim()) prefix = before.trimEnd()
  const body = dedent(content)
    .map((l) => (l ? indent + l : ''))
    .join('\n')
  ctx.out += `${prefix}\n${prefix ? '\n' : ''}${indent}$$\n${body}\n${indent}$$\n`
  // satırın geri kalanı boşsa satır sonuna kadar atla
  const le = lineEnd(ctx.text, end)
  return ctx.text.slice(end, le).trim() ? end : le
}
