import { describe, it, expect } from 'vitest'
import { convertBlocks, countBlocks, countDocBlocks, pageMeta, type ConvertContext } from '@core/notion/convert'
import * as B from '../../../fixtures/notion/builders'

function ctx(files: Record<string, string> = {}, titles: Record<string, string> = {}) {
  const events: { kind: string; detail: string }[] = []
  const c: ConvertContext = { file: (u) => files[u] ?? null, pageTitle: (i) => titles[i] ?? null, report: (e) => events.push(e) }
  return { c, events }
}
const p = (...content: unknown[]) => ({ type: 'paragraph', content })
const txt = (text: string, marks?: unknown[]) => (marks ? { type: 'text', text, marks } : { type: 'text', text })

describe('convertBlocks', () => {
  it('zengin metin: işaretler, link, renk, formül, sayfa ve tarih bahsetmesi', () => {
    const { c } = ctx({}, { 'pg-mars': 'Mars' })
    const out = convertBlocks(
      [B.para(B.t('kalın', { bold: true }), B.t(' '), B.t('kod', { code: true }), B.t(' '), B.t('link', {}, 'https://ornek.dev'), B.t(' '), B.t('sarı', { color: 'yellow_background' }), B.t(' '), B.eq('E=mc^2'), B.t(' '), B.mentionPage('pg-mars', 'eski ad'), B.t(' '), B.mentionDate('2026-03-08'))],
      c
    )
    expect(out).toEqual([
      p(
        txt('kalın', [{ type: 'bold' }]),
        txt(' '),
        txt('kod', [{ type: 'code' }]),
        txt(' '),
        txt('link', [{ type: 'link', attrs: { href: 'https://ornek.dev' } }]),
        txt(' '),
        txt('sarı', [{ type: 'highlight', attrs: { color: 'yellow' } }]),
        txt(' '),
        { type: 'inlineMath', attrs: { latex: 'E=mc^2' } },
        txt(' '),
        { type: 'wikiLink', attrs: { target: 'Mars', label: null } },
        txt(' 08.03.2026')
      )
    ])
  })
  it('başlıklar, açılır başlık ve toggle', () => {
    const { c } = ctx()
    expect(convertBlocks([B.h(2, 'Yörünge'), B.h(3, 'Ayrıntı', true, [B.para(B.t('gizli'))]), B.toggle('Aç', [B.para(B.t('iç'))])], c)).toEqual([
      { type: 'heading', attrs: { level: 2 }, content: [txt('Yörünge')] },
      { type: 'details', attrs: { card: false, heading: 3 }, content: [{ type: 'detailsSummary', content: [txt('Ayrıntı')] }, { type: 'detailsContent', content: [p(txt('gizli'))] }] },
      { type: 'details', attrs: { card: false, heading: null }, content: [{ type: 'detailsSummary', content: [txt('Aç')] }, { type: 'detailsContent', content: [p(txt('iç'))] }] }
    ])
  })
  it('ardışık liste öğeleri tek listede gruplanır, iç içe çocuklar korunur', () => {
    const { c } = ctx()
    expect(convertBlocks([B.bullet('a', [B.bullet('a1')]), B.bullet('b'), B.numbered('bir'), B.todo('yap', true)], c)).toEqual([
      { type: 'bulletList', content: [{ type: 'listItem', content: [p(txt('a')), { type: 'bulletList', content: [{ type: 'listItem', content: [p(txt('a1'))] }] }] }, { type: 'listItem', content: [p(txt('b'))] }] },
      { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [p(txt('bir'))] }] },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(txt('yap'))] }] }
    ])
  })
  it('callout rengi türe, kod dili normalize, formül, ayırıcı, alıntı', () => {
    const { c } = ctx()
    expect(convertBlocks([B.callout('dikkat', 'red_background', '🚨'), B.callout('not', 'gray_background', null), B.code('print(1)', 'python'), B.code('düz', 'plain text'), B.code('x', 'c++'), B.equation('\\int x'), B.divider(), B.quote('söz')], c)).toEqual([
      { type: 'callout', attrs: { type: 'danger', icon: '🚨', title: '' }, content: [p(txt('dikkat'))] },
      { type: 'callout', attrs: { type: 'note', icon: null, title: '' }, content: [p(txt('not'))] },
      { type: 'codeBlock', attrs: { language: 'python', lineNumbers: false }, content: [txt('print(1)')] },
      { type: 'codeBlock', attrs: { language: null, lineNumbers: false }, content: [txt('düz')] },
      { type: 'codeBlock', attrs: { language: 'cpp', lineNumbers: false }, content: [txt('x')] },
      { type: 'blockMath', attrs: { latex: '\\int x' } },
      { type: 'horizontalRule' },
      { type: 'blockquote', content: [p(txt('söz'))] }
    ])
  })
  it('dosyalar: indirilen görsel ve pdf, indirilemeyen görsel link + rapor, bookmark', () => {
    const { c, events } = ctx({ 'https://f/1.png': 'attachments/1-abc.png', 'https://f/s.pdf': 'attachments/s-def.pdf' })
    expect(convertBlocks([B.image('https://f/1.png', 'Şekil 1'), B.image('https://f/kayip.png'), B.pdf('https://f/s.pdf'), B.bookmark('https://ornek.dev')], c)).toEqual([
      { type: 'image', attrs: { src: 'attachments/1-abc.png', alt: '', width: null, caption: 'Şekil 1' } },
      p(txt('🖼 '), txt('https://f/kayip.png', [{ type: 'link', attrs: { href: 'https://f/kayip.png' } }])),
      { type: 'pdfEmbed', attrs: { src: 'attachments/s-def.pdf' } },
      p(txt('🔗 '), txt('https://ornek.dev', [{ type: 'link', attrs: { href: 'https://ornek.dev' } }]))
    ])
    expect(events).toEqual([{ kind: 'file-failed', detail: 'https://f/kayip.png' }])
  })
  it('tablo, alt sayfa ve sayfa linki wiki link olur, sütunlar düzleşir, desteklenmeyen raporlanır', () => {
    const { c, events } = ctx({}, { 'pg-a': 'Algoritmalar', 'pg-m': 'Mars (2)' })
    const out = convertBlocks([B.table([['Ad', 'Yıl'], ['Quicksort', '1959']]), B.childPage('pg-a', 'Algoritmalar'), B.linkToPage('pg-m'), B.columns([B.para(B.t('sol'))], [B.para(B.t('sağ'))]), B.unsupported('ai_block')], c)
    expect(out).toEqual([
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: [{ type: 'tableHeader', attrs: { align: null }, content: [p(txt('Ad'))] }, { type: 'tableHeader', attrs: { align: null }, content: [p(txt('Yıl'))] }] },
          { type: 'tableRow', content: [{ type: 'tableCell', attrs: { align: null }, content: [p(txt('Quicksort'))] }, { type: 'tableCell', attrs: { align: null }, content: [p(txt('1959'))] }] }
        ]
      },
      p({ type: 'wikiLink', attrs: { target: 'Algoritmalar', label: null } }),
      p({ type: 'wikiLink', attrs: { target: 'Mars (2)', label: null } }),
      p(txt('sol')),
      p(txt('sağ')),
      p(txt('[Desteklenmeyen Notion bloğu: ai_block]'))
    ])
    expect(events).toEqual([
      { kind: 'flattened', detail: 'column_list' },
      { kind: 'unsupported', detail: 'ai_block' }
    ])
  })
})

describe('pageMeta ve blok sayımı', () => {
  it('emoji ikon ve indirilen kapak', () => {
    const { c } = ctx({ 'https://f/kapak.jpg': 'attachments/kapak-1.jpg' })
    expect(pageMeta(B.page('x', 'Mars', { emoji: '🪐', cover: 'https://f/kapak.jpg' }), c)).toEqual({ icon: '🪐', cover: 'attachments/kapak-1.jpg' })
  })
  it('Notion ve Kernel blok sayıları eşleşir', () => {
    const { c } = ctx()
    const blocks = [B.h(2, 'a'), B.para(B.t('b')), B.para(), B.bullet('c', [B.bullet('d')]), B.callout('e', 'blue_background'), B.toggle('f', [B.para(B.t('g'))]), B.table([['h', 'i'], ['j', 'k']])]
    const doc = { type: 'doc', content: convertBlocks(blocks, c) }
    expect(countBlocks(blocks)).toBe(countDocBlocks(doc))
  })
})
