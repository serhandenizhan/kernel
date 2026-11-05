import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { tNow } from '../../lib/i18n'

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
      className="table-menu glass glass-pop"
    >
      <button onClick={() => editor.chain().focus().addRowAfter().run()}>{tNow('table.addRow')}</button>
      <button onClick={() => editor.chain().focus().addColumnAfter().run()}>{tNow('table.addColumn')}</button>
      <button onClick={() => editor.chain().focus().deleteRow().run()}>{tNow('table.deleteRow')}</button>
      <button onClick={() => editor.chain().focus().deleteColumn().run()}>{tNow('table.deleteColumn')}</button>
      <span className="sep" />
      <button title={tNow('table.alignLeft')} onClick={() => setAlign('left')}>⇤</button>
      <button title={tNow('table.alignCenter')} onClick={() => setAlign('center')}>↔</button>
      <button title={tNow('table.alignRight')} onClick={() => setAlign('right')}>⇥</button>
      <span className="sep" />
      <button className="danger" onClick={() => editor.chain().focus().deleteTable().run()}>
        {tNow('table.delete')}
      </button>
    </BubbleMenu>
  )
}
