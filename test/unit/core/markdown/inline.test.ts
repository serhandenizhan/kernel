import { describe, it, expect } from 'vitest'
import { markdownToDoc } from '@core/markdown/parse'

const inline = (md: string) => (markdownToDoc(md).content![0] as { content: unknown[] }).content

describe('markdownToDoc — satır içi', () => {
  it('kalın, italik, üstü çizili, kod, link', () => {
    expect(inline('**k** *i* ~~s~~ `c` [l](https://x.y)')).toEqual([
      { type: 'text', text: 'k', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'i', marks: [{ type: 'italic' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 's', marks: [{ type: 'strike' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'c', marks: [{ type: 'code' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'l', marks: [{ type: 'link', attrs: { href: 'https://x.y' } }] }
    ])
  })
  it('iç içe işaretler sabit sırada', () => {
    expect(inline('***ki***')).toEqual([{ type: 'text', text: 'ki', marks: [{ type: 'bold' }, { type: 'italic' }] }])
  })
  it('altı çizili ve renkli/renksiz vurgu', () => {
    expect(inline('<u>a</u> <mark data-color="yellow">b</mark> ==c==')).toEqual([
      { type: 'text', text: 'a', marks: [{ type: 'underline' }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'b', marks: [{ type: 'highlight', attrs: { color: 'yellow' } }] },
      { type: 'text', text: ' ' },
      { type: 'text', text: 'c', marks: [{ type: 'highlight', attrs: { color: null } }] }
    ])
  })
  it('kaçırılmış == vurgu olmaz, satır içi koddaki \\= korunur', () => {
    expect(inline('a \\=\\= b `x \\= y`')).toEqual([
      { type: 'text', text: 'a == b ' },
      { type: 'text', text: 'x \\= y', marks: [{ type: 'code' }] }
    ])
  })
  it('sert satır sonu', () => {
    expect(inline('a  \nb')).toEqual([{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }])
  })
})
