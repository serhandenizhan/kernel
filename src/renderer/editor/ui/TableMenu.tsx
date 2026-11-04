import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'

type Align = 'left' | 'center' | 'right' | null

// İmleç tablodayken üstte beliren cam araç çubuğu
export function TableMenu({ editor }: { editor: Editor }) {
  const setAlign = (align: Align) => {
    editor.chain().focus().setCellAttribute('align', align).run()
  }
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      shouldShow={({ editor: e }) => e.isEditable && e.isActive('table')}
      options={{ placement: 'top' }}
      className="table-menu glass"
    >
      <button onClick={() => editor.chain().focus().addRowAfter().run()}>+ Satır</button>
      <button onClick={() => editor.chain().focus().addColumnAfter().run()}>+ Sütun</button>
      <button onClick={() => editor.chain().focus().deleteRow().run()}>− Satır</button>
      <button onClick={() => editor.chain().focus().deleteColumn().run()}>− Sütun</button>
      <span className="sep" />
      <button title="Sola hizala" onClick={() => setAlign('left')}>⇤</button>
      <button title="Ortala" onClick={() => setAlign('center')}>↔</button>
      <button title="Sağa hizala" onClick={() => setAlign('right')}>⇥</button>
      <span className="sep" />
      <button className="danger" onClick={() => editor.chain().focus().deleteTable().run()}>
        Tabloyu sil
      </button>
    </BubbleMenu>
  )
}
