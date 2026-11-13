import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadCases } from '../../../fixtures/paste/load'
import { convertPaste } from '@core/smart-paste'
import { markdownToDoc } from '@core/markdown/parse'
import type { PasteSettings } from '@shared/types'
import { perfBudget } from '../../helpers/perf'

const ALL: PasteSettings = { stripCitations: true, latexLineHeuristic: true, unfencedCodeHeuristic: true }

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
    // CI'nın Windows makinesi geliştirme makinesinden belirgin yavaş
    expect(performance.now() - t).toBeLessThan(perfBudget(process.platform === 'win32' ? 1500 : 300))
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
