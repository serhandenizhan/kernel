import type { Editor } from '@tiptap/core'
import { insertImageFiles } from './nodes/Image'
import { useMathEdit } from './ui/math-state'

export interface SlashItem {
  id: string
  label: string
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
  label: `Başlık ${level}`,
  keywords: ['baslik', 'heading', `h${level}`],
  icon: `H${level}`,
  run: (e) => e.chain().focus().setNode('heading', { level }).run()
})

// "/" menüsündeki öğeler (Rehber de bunları listeler)
export const SLASH_ITEMS: SlashItem[] = [
  { id: 'text', label: 'Metin', keywords: ['paragraf', 'text', 'duz'], icon: '¶', run: (e) => e.chain().focus().setParagraph().run() },
  heading(1),
  heading(2),
  heading(3),
  heading(4),
  heading(5),
  heading(6),
  { id: 'bullet', label: 'Madde listesi', keywords: ['liste', 'madde', 'bullet'], icon: '•', run: (e) => e.chain().focus().toggleBulletList().run() },
  { id: 'ordered', label: 'Numaralı liste', keywords: ['liste', 'numara', 'sirali'], icon: '1.', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { id: 'task', label: 'Yapılacaklar', keywords: ['todo', 'gorev', 'checkbox', 'yapilacak'], icon: '☑', run: (e) => e.chain().focus().toggleTaskList().run() },
  { id: 'toggle', label: 'Toggle', keywords: ['ac', 'kapa', 'details', 'katlanir'], icon: '▸', run: (e) => e.chain().focus().setDetails().run() },
  { id: 'callout', label: 'Callout', keywords: ['not', 'uyari', 'ipucu', 'kutu'], icon: '💡', run: (e) => e.chain().focus().wrapIn('callout', { type: 'note' }).run() },
  { id: 'quote', label: 'Alıntı', keywords: ['alinti', 'quote'], icon: '❝', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { id: 'code', label: 'Kod', keywords: ['kod', 'code', 'program'], icon: '{ }', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  {
    id: 'math',
    label: 'Formül',
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
    label: 'Satır içi formül',
    keywords: ['formul', 'inline', 'latex'],
    icon: '𝑥',
    run: (e) => {
      const pos = e.state.selection.from
      e.chain().focus().insertContent({ type: 'inlineMath', attrs: { latex: '' } }).run()
      setTimeout(() => useMathEdit.getState().open('inline', pos, ''), 0)
    }
  },
  { id: 'image', label: 'Görsel', keywords: ['resim', 'gorsel', 'image', 'foto'], icon: '🖼', run: (e) => pickFiles(e, 'image/*') },
  { id: 'pdf', label: 'PDF', keywords: ['pdf', 'slayt', 'belge', 'dosya'], icon: '📄', run: (e) => pickFiles(e, 'application/pdf') },
  { id: 'table', label: 'Tablo', keywords: ['tablo', 'table'], icon: '▦', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'divider', label: 'Ayırıcı', keywords: ['cizgi', 'ayirici', 'divider', 'hr'], icon: '—', run: (e) => e.chain().focus().setHorizontalRule().run() }
]
