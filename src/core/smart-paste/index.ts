import katex from 'katex'
import type { PasteSettings } from '@shared/types'
import { markdownToDoc } from '../markdown/parse'
import { docToMarkdown } from '../markdown/serialize'
import type { JSONContent } from '../markdown/schema'
import { protectCode } from './protect'
import { normalizeEscapes } from './escapes'
import { extractMath } from './math'
import { latexLineScore, LATEX_LINE_BLOCK, LATEX_LINE_SUGGEST } from './latex-line'
import { stripCitations } from './citations'
import { detectUnfencedCode } from './code-detect'
import { detectLanguage, normalizeLanguage } from './language'
import { htmlToMarkdown } from './html'

export type PasteOptions = PasteSettings

export interface PasteWarning {
  kind: 'invalid-latex' | 'image-failed'
  text: string
}
export interface PasteSuggestion {
  kind: 'latex-line'
  line: string
}
export interface PasteResult {
  markdown: string
  doc: JSONContent
  warnings: PasteWarning[]
  suggestions: PasteSuggestion[]
  /** yapıştırılan HTML'deki temizlenmiş SVG grafikler; Markdown'da ![](kernel-svg:n) olarak yer tutar */
  svgs: string[]
}

// Yapıştırılan metni / HTML'i Kernel belgesine çevirir (spec §7)
export function convertPaste(input: { text: string; html?: string }, options: PasteOptions): PasteResult {
  const warnings: PasteWarning[] = []
  const suggestions: PasteSuggestion[] = []

  let src = input.text
  const svgs: string[] = []
  if (input.html) {
    const fromHtml = htmlToMarkdown(input.html, svgs)
    if (fromHtml !== null) src = fromHtml
  }
  src = src.replace(/\r\n?/g, '\n')

  const code = protectCode(src)
  let s = normalizeEscapes(code.text)
  s = extractMath(s)
  if (options.latexLineHeuristic) s = applyLatexLines(s, suggestions)

  const math = protectMath(s, warnings)
  s = math.text
  if (options.stripCitations) s = stripCitations(s)
  if (options.unfencedCodeHeuristic) s = detectUnfencedCode(s)
  s = code.restore(math.restore(s))
  s = fixFenceLanguages(s)

  const doc = markdownToDoc(s)
  return { markdown: docToMarkdown(doc), doc, warnings, suggestions, svgs }
}

function applyLatexLines(text: string, suggestions: PasteSuggestion[]): string {
  let inBlock = false
  return text
    .split('\n')
    .map((line) => {
      // $$ blokları içindeki satırlar zaten formüldür
      if (line.trim() === '$$') {
        inBlock = !inBlock
        return line
      }
      if (inBlock || line.includes('$') || line.includes('\u0000')) return line
      const score = latexLineScore(line)
      if (score >= LATEX_LINE_BLOCK) {
        const indent = /^\s*/.exec(line)![0]
        return `\n${indent}$$\n${indent}${line.trim()}\n${indent}$$\n`
      }
      if (score >= LATEX_LINE_SUGGEST) suggestions.push({ kind: 'latex-line', line: line.trim() })
      return line
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

const MATH_RE = /\$\$\n([\s\S]*?)\n[ \t]*\$\$|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g
const MD_SPECIAL = /[\\`*_[\]<>#|~=$]/g

/** Formülleri gizler ve KaTeX ile doğrular; geçersiz olanlar metne döner */
function protectMath(text: string, warnings: PasteWarning[]): { text: string; restore(s: string): string } {
  const saved: string[] = []
  const out = text.replace(MATH_RE, (whole, block: string | undefined, inline: string | undefined) => {
    const latex = (block ?? inline ?? '').replace(/^[ \t]+/gm, '').trim()
    let replacement = whole
    try {
      katex.renderToString(latex, { throwOnError: true, displayMode: block !== undefined, strict: 'ignore' })
    } catch {
      warnings.push({ kind: 'invalid-latex', text: latex })
      replacement = `\\\\(${latex.replace(MD_SPECIAL, '\\$&')}\\\\)`
    }
    saved.push(replacement)
    return `\u0000M${saved.length - 1}\u0000`
  })
  return { text: out, restore: (s) => s.replace(/\u0000M(\d+)\u0000/g, (_, n: string) => saved[Number(n)] ?? '') }
}

/** Çit etiketlerini normalize eder, etiketsiz çitlerin dilini tespit eder */
function fixFenceLanguages(text: string): string {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const open = /^(\s*)(`{3,}|~{3,})\s*([^\s{]*)(.*)$/.exec(lines[i]!)
    if (!open) continue
    const [, indent, fence, tag, meta] = open
    const closeRe = new RegExp(`^\\s*${fence![0] === '`' ? '`' : '~'}{${fence!.length},}\\s*$`)
    let j = i + 1
    while (j < lines.length && !closeRe.test(lines[j]!)) j++
    const body = lines.slice(i + 1, j).join('\n')
    const lang = tag ? normalizeLanguage(tag) : detectLanguage(body)
    lines[i] = `${indent}${fence}${lang ?? ''}${lang && meta!.trim() ? ` ${meta!.trim()}` : ''}`
    i = j
  }
  return lines.join('\n')
}
