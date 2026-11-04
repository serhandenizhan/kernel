import { describe, it, expect } from 'vitest'
import { detectLanguage, normalizeLanguage } from '@core/smart-paste/language'
import { convertPaste } from '@core/smart-paste'

const ALL = { stripCitations: true, latexLineHeuristic: true, unfencedCodeHeuristic: true }

describe('mermaid tespiti', () => {
  it('etiketsiz mermaid kodunu tanır', () => {
    expect(detectLanguage('graph TD\n  A-->B')).toBe('mermaid')
    expect(detectLanguage('\nsequenceDiagram\n  A->>B: selam')).toBe('mermaid')
    expect(detectLanguage('flowchart LR\n  x --> y')).toBe('mermaid')
  })
  it('etiket korunur', () => {
    expect(normalizeLanguage('Mermaid')).toBe('mermaid')
  })
  it('yapıştırılan etiketsiz mermaid çiti mermaid bloğu olur', () => {
    const doc = convertPaste({ text: '```\ngraph TD\n  Başla --> Bitir\n```' }, ALL).doc
    expect(doc.content![0]!.attrs!['language']).toBe('mermaid')
  })
})
