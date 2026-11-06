import type { Editor } from '@tiptap/core'
import { insertImageFiles } from './nodes/Image'
import { useMathEdit } from './ui/math-state'
import { tNow } from '../lib/i18n'
import { CHART_TYPES, defaultChart, serializeChart, type ChartType } from '@core/charts/spec'
import { chartFocus, typeLabel } from './ui/ChartBlock'

export interface SlashItem {
  id: string
  readonly label: string
  keywords: string[]
  icon: string
  run(editor: Editor): void
}

function pickFiles(editor: Editor, accept: string): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = true
  input.onchange = () => void insertImageFiles(editor.view, Array.from(input.files ?? []))
  input.click()
}

const heading = (level: 1 | 2 | 3 | 4 | 5 | 6): SlashItem => ({
  id: `h${level}`,
  get label() {
    return tNow('slash.heading', { level })
  },
  keywords: ['baslik', 'heading', `h${level}`],
  icon: `H${level}`,
  run: (e) => e.chain().focus().setNode('heading', { level }).run()
})

const CHART_ICON: Record<ChartType, string> = { bar: '▮▮', hbar: '☰', line: '⟋', area: '◭', pie: '◔', donut: '◎', scatter: '⁘', radar: '✶', flow: '⇢', plane: '⊹' }
const CHART_WORDS: Record<ChartType, string[]> = {
  bar: ['sutun', 'column', 'bar'],
  hbar: ['cubuk', 'yatay', 'bar'],
  line: ['cizgi', 'line', 'trend'],
  area: ['alan', 'area'],
  pie: ['pasta', 'pie', 'yuzde', 'dilim'],
  donut: ['halka', 'donut', 'yuzde'],
  scatter: ['dagilim', 'scatter', 'nokta'],
  radar: ['radar', 'orumcek'],
  flow: ['akis', 'flowchart', 'diyagram', 'adim', 'surec'],
  plane: ['duzlem', 'koordinat', 'eksen', 'xyz', 'grafik', '3b']
}

/** Grafik öğesi: kolay düzenlenen örnek veriyle ```chart bloğu ekler, düzenleme paneli açık gelir */
const chartItem = (type: ChartType): SlashItem => ({
  id: `chart-${type}`,
  get label() {
    return type === 'flow' ? tNow('slash.flow') : type === 'plane' ? tNow('slash.plane') : tNow('slash.chart', { type: typeLabel(type) })
  },
  keywords: ['grafik', 'chart', 'diyagram', ...CHART_WORDS[type]],
  icon: CHART_ICON[type],
  run: (e) => {
    const L = { item: tNow('chart.sample.item'), series: tNow('chart.sample.series'), node: tNow('chart.sample.node'), point: tNow('chart.sample.point') }
    chartFocus.pending = true
    e.chain()
      .focus()
      .insertContent([{ type: 'codeBlock', attrs: { language: 'chart' }, content: [{ type: 'text', text: serializeChart(defaultChart(type, L)) }] }, { type: 'paragraph' }])
      .run()
  }
})

// "/" menüsündeki öğeler (Rehber de bunları listeler)
export const SLASH_ITEMS: SlashItem[] = [
  { id: 'text', get label() { return tNow('slash.text') }, keywords: ['paragraf', 'text', 'duz'], icon: '¶', run: (e) => e.chain().focus().setParagraph().run() },
  heading(1),
  heading(2),
  heading(3),
  heading(4),
  heading(5),
  heading(6),
  { id: 'bullet', get label() { return tNow('slash.bullet') }, keywords: ['liste', 'madde', 'bullet'], icon: '•', run: (e) => e.chain().focus().toggleBulletList().run() },
  { id: 'ordered', get label() { return tNow('slash.ordered') }, keywords: ['liste', 'numara', 'sirali'], icon: '1.', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: 'task', get label() { return tNow('slash.task') }, keywords: ['todo', 'gorev', 'checkbox', 'yapilacak'], icon: '☑', run: (e) => e.chain().focus().toggleTaskList().run() },
  {
    id: 'card',
    get label() { return tNow('slash.card') },
    keywords: ['kart', 'flashcard', 'soru', 'cevap', 'tekrar', 'card'],
    icon: '⇄',
    // "Soru :: Cevap" satırı; soru seçili gelir, yazınca yerine geçer
    run: (e) => {
      const q = tNow('slash.cardQuestion')
      const line = `${q} :: ${tNow('slash.cardAnswer')}`
      e.chain().focus().setParagraph().insertContent(line).run()
      const end = e.state.selection.from
      e.commands.setTextSelection({ from: end - line.length, to: end - line.length + q.length })
    }
  },
  {
    id: 'cardToggle',
    get label() { return tNow('slash.cardToggle') },
    keywords: ['kart', 'katlanir', 'flashcard', 'soru', 'cevap', 'card'],
    icon: '▸⇄',
    // katlanır blok: başlık soru, içerik cevap; kart olarak işaretli gelir
    run: (e) => {
      e.chain().focus().setDetails().run()
      const $from = e.state.selection.$from
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === 'details') {
          const pos = $from.before(d)
          const sel = e.state.selection
          e.view.dispatch(e.state.tr.setNodeAttribute(pos, 'card', true))
          // açık gelsin: özette Enter cevaba geçer
          const dom = e.view.nodeDOM(pos) as HTMLElement | null
          dom?.querySelector<HTMLButtonElement>(':scope > button')?.click()
          e.chain().focus().setTextSelection(sel.from).run()
          break
        }
      }
    }
  },
  { id: 'toggle', get label() { return tNow('slash.toggle') }, keywords: ['ac', 'kapa', 'details', 'katlanir'], icon: '▸', run: (e) => e.chain().focus().setDetails().run() },
  { id: 'callout', get label() { return tNow('slash.callout') }, keywords: ['not', 'uyari', 'ipucu', 'kutu'], icon: '💡', run: (e) => e.chain().focus().wrapIn('callout', { type: 'note' }).run() },
  { id: 'quote', get label() { return tNow('slash.quote') }, keywords: ['alinti', 'quote'], icon: '❝', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: 'code', get label() { return tNow('slash.code') }, keywords: ['kod', 'code', 'program'], icon: '{ }', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  {
    id: 'math',
    get label() { return tNow('slash.math') },
    keywords: ['formul', 'denklem', 'latex', 'math'],
    icon: '∑',
    run: (e) => {
      const pos = e.state.selection.$from.before()
      e.chain()
        .focus()
        .command(({ tr, state }) => {
          const $from = state.selection.$from
          tr.replaceRangeWith($from.before(), $from.after(), state.schema.nodes['blockMath']!.create({ latex: '' }))
          return true
        })
        .run()
      setTimeout(() => useMathEdit.getState().open('block', pos, ''), 0)
    }
  },
  {
    id: 'inline-math',
    get label() { return tNow('slash.inlineMath') },
    keywords: ['formul', 'inline', 'latex'],
    icon: '𝑥',
    run: (e) => {
      const pos = e.state.selection.from
      e.chain().focus().insertContent({ type: 'inlineMath', attrs: { latex: '' } }).run()
      setTimeout(() => useMathEdit.getState().open('inline', pos, ''), 0)
    }
  },
  { id: 'image', get label() { return tNow('slash.image') }, keywords: ['resim', 'gorsel', 'image', 'foto'], icon: '🖼', run: (e) => pickFiles(e, 'image/*') },
  { id: 'pdf', get label() { return tNow('slash.pdf') }, keywords: ['pdf', 'slayt', 'belge', 'dosya'], icon: '📄', run: (e) => pickFiles(e, 'application/pdf') },
  { id: 'table', get label() { return tNow('slash.table') }, keywords: ['tablo', 'table'], icon: '▦', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'divider', get label() { return tNow('slash.divider') }, keywords: ['cizgi', 'ayirici', 'divider', 'hr'], icon: '—', run: (e) => e.chain().focus().setHorizontalRule().run() },
  ...CHART_TYPES.map(chartItem)
]
