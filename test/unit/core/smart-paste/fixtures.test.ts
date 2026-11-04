import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { convertPaste } from '@core/smart-paste'
import { markdownToDoc } from '@core/markdown/parse'
import type { PasteSettings } from '@shared/types'

const ALL: PasteSettings = { stripCitations: true, latexLineHeuristic: true, unfencedCodeHeuristic: true }

interface Case {
  name: string
  input?: string
  html?: string
  text?: string
  expected: string
}

export function loadCases(): Case[] {
  const raw = readFileSync(join(__dirname, '../../../fixtures/paste/cases.txt'), 'utf8')
  return raw
    .split(/^=== (.+) ===$/m)
    .slice(1)
    .reduce<Case[]>((acc, part, i, arr) => {
      if (i % 2 === 0) {
        const body = arr[i + 1] ?? ''
        const sections: Record<string, string> = {}
        const pieces = body.split(/^--- (input|html|text|expected) ---$/m).slice(1)
        for (let k = 0; k < pieces.length; k += 2) sections[pieces[k]!] = pieces[k + 1]!.replace(/^\n/, '').replace(/\n+$/, '')
        acc.push({ name: part, input: sections['input'], html: sections['html'], text: sections['text'], expected: sections['expected'] ?? '' })
      }
      return acc
    }, [])
}

const cases = loadCases()

describe('convertPaste — sentetik örnekler', () => {
  it('örnek dosyası yüklendi', () => {
    expect(cases.length).toBeGreaterThanOrEqual(18)
  })
  for (const c of cases) {
    it(c.name, () => {
      const res = convertPaste({ text: c.input ?? c.text ?? '', html: c.html }, ALL)
      expect(res.doc).toEqual(markdownToDoc(c.expected))
    })
  }
  it('hatalı LaTeX uyarı üretir', () => {
    const c = cases.find((x) => x.name === 'invalid-latex')!
    expect(convertPaste({ text: c.input! }, ALL).warnings).toEqual([{ kind: 'invalid-latex', text: '\\frac{a' }])
  })
  it('kararsız LaTeX satırı öneri olarak döner', () => {
    const line = 'Kayıp \\sum_{i=1}^{n} (y_i - \\hat{y}_i)^2'
    const res = convertPaste({ text: line }, ALL)
    expect(res.doc).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: line }] }] })
    expect(res.suggestions).toEqual([{ kind: 'latex-line', line }])
  })
  it('blok formülün içindeki satırlar öneri üretmez', () => {
    const c = cases.find((x) => x.name === 'list-block-math')!
    expect(convertPaste({ text: c.input! }, ALL).suggestions).toEqual([])
  })
  it('ayarlar kapalıyken sezgiler çalışmaz', () => {
    const off: PasteSettings = { stripCitations: false, latexLineHeuristic: false, unfencedCodeHeuristic: false }
    const res = convertPaste({ text: 'çalışır.[1]' }, off)
    expect(res.doc).toEqual(markdownToDoc('çalışır.\\[1]'))
  })
  it('büyük girdi hızlıdır', () => {
    const big = cases.map((c) => c.input ?? c.text ?? '').join('\n\n').repeat(10)
    const t = performance.now()
    convertPaste({ text: big }, ALL)
    expect(performance.now() - t).toBeLessThan(300)
  })
})

// Kullanıcının gerçek örnekleri (repoda yok, gitignore'lu) — varsa çalışır
const privateDir = join(__dirname, '../../../fixtures/private')
const privateFiles = existsSync(privateDir) ? readdirSync(privateDir).filter((f) => f.endsWith('.md')) : []
describe.skipIf(privateFiles.length === 0)('convertPaste — özel örnekler', () => {
  for (const f of privateFiles) {
    it(f, () => {
      const res = convertPaste({ text: readFileSync(join(privateDir, f), 'utf8') }, ALL)
      expect(res.warnings).toEqual([])
      expect(res.markdown).not.toMatch(/\\\\[([]/)
      expect(res.markdown).not.toMatch(/\\[([](?![^$]*\$)/)
      expect(JSON.stringify(res.doc)).toContain('"type":"inlineMath"')
      expect(JSON.stringify(res.doc)).toContain('"type":"blockMath"')
      expect(JSON.stringify(res.doc)).toContain('"type":"table"')
    })
  }
})
