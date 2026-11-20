import { describe, expect, it } from 'vitest'
import { cardId, extractCards, legacyCardId } from '@core/cards'

describe('extractCards', () => {
  it('reads "Question :: Answer" lines and card-marked toggles, skipping code', () => {
    const md = [
      'Özdeğer nedir? :: Av = λv sağlayan λ',
      '- Liste içinde :: olur',
      '```',
      'kod :: değil',
      '```',
      '<details data-card>',
      '<summary>Determinant formülü</summary>',
      '',
      '$$\\det(A)$$',
      '',
      '</details>',
      '<details>',
      '<summary>Normal toggle</summary>',
      'gizli',
      '</details>'
    ].join('\n')
    const cards = extractCards('P1', md)
    expect(cards.map((c) => [c.question, c.answer])).toEqual([
      ['Özdeğer nedir?', 'Av = λv sağlayan λ'],
      ['Liste içinde', 'olur'],
      ['Determinant formülü', '$$\\det(A)$$']
    ])
    expect(cards[0]!.id).toBe(cardId('P1', 'Özdeğer nedir?'))
    expect(cards.every((c) => c.pageId === 'P1')).toBe(true)
  })

  it('ignores lines with an empty side and urls with ::', () => {
    expect(extractCards('P', ' :: cevap\nsoru :: \nstd::vector')).toEqual([])
  })

  it('extracts card-marked toggles whose answer is a code block', () => {
    const md = '<details data-card>\n<summary>Soru</summary>\n\n```py\nx\n```\n</details>\n'
    expect(extractCards('P1', md).map((c) => [c.question, c.answer])).toEqual([['Soru', '```py\nx\n```']])
  })

  it('ignores :: inside table rows and <details data-card> inside fenced code', () => {
    const md = '| A :: B | C |\n| --- | --- |\n```\n<details data-card>\n<summary>Kod</summary>\nx\n</details>\n```\n'
    expect(extractCards('P1', md)).toEqual([])
  })
})

describe('cardId', () => {
  it('is stable under case, spacing and punctuation changes but differs per page and question', () => {
    expect(cardId('P', 'Özdeğer  nedir?')).toBe(cardId('P', 'özdeğer nedir'))
    expect(cardId('P', 'a')).not.toBe(cardId('Q', 'a'))
    expect(cardId('P', 'a')).not.toBe(cardId('P', 'b'))
  })

  it('distinguishes math operators while keeping existing prose card IDs identical', () => {
    expect(cardId('P', '$a + b$')).not.toBe(cardId('P', '$a - b$'))
    expect(cardId('P', '$x^2$')).not.toBe(cardId('P', '$x_2$'))
    expect(cardId('P', 'Özdeğer nedir?')).toBe(legacyCardId('P', 'Özdeğer nedir?'))
    expect(cardId('P', 'Soru-cevap nedir?')).toBe(legacyCardId('P', 'Soru-cevap nedir?'))
  })
})

import { cardLineSplit } from '@core/cards'
describe('cardLineSplit', () => {
  it('soru, ayraç ve cevabın konumlarını verir', () => {
    expect(cardLineSplit('Başkent :: Ankara')).toEqual({ qFrom: 0, qTo: 7, sepFrom: 7, sepTo: 11, aFrom: 11, aTo: 17 })
  })
  it('madde işaretli satırda soru işaretten sonra başlar', () => {
    expect(cardLineSplit('- Soru :: Cevap')?.qFrom).toBe(2)
  })
  it('cevap ya da soru yoksa null', () => {
    expect(cardLineSplit('Soru ::')).toBeNull()
    expect(cardLineSplit(':: Cevap')).toBeNull()
    expect(cardLineSplit('düz metin')).toBeNull()
  })
})
