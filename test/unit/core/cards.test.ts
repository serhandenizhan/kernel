import { describe, expect, it } from 'vitest'
import { cardId, extractCards } from '@core/cards'

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
})

describe('cardId', () => {
  it('is stable under case, spacing and punctuation changes but differs per page and question', () => {
    expect(cardId('P', 'Özdeğer  nedir?')).toBe(cardId('P', 'özdeğer nedir'))
    expect(cardId('P', 'a')).not.toBe(cardId('Q', 'a'))
    expect(cardId('P', 'a')).not.toBe(cardId('P', 'b'))
  })
})
