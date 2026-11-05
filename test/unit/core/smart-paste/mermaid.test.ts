import { describe, it, expect } from 'vitest'
import { detectLanguage, looksLikeMermaid, normalizeLanguage } from '@core/smart-paste/language'
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

describe('looksLikeMermaid', () => {
  it('diyagram türüyle başlayan kod mermaid sayılır (yorum ve init satırları atlanır)', () => {
    expect(looksLikeMermaid('graph TD\n  A-->B')).toBe(true)
    expect(looksLikeMermaid('%% not\n%%{init: {"theme":"dark"}}%%\nsequenceDiagram\n  A->>B: selam')).toBe(true)
    expect(looksLikeMermaid('---\ntitle: Gezegenler\n---\nflowchart LR\n  A-->B')).toBe(true)
    expect(looksLikeMermaid('timeline\n  1610 : Galileo')).toBe(true)
    expect(looksLikeMermaid('gitGraph\n  commit')).toBe(true)
  })
  it('düz metin ağaç çizimi mermaid sayılmaz', () => {
    expect(looksLikeMermaid('Gezegenler\n│\n├── Kayalık\n│   └── Mars\n└── Gaz devleri')).toBe(false)
    expect(looksLikeMermaid('')).toBe(false)
  })
})
