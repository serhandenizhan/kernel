import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { tNow } from '../../lib/i18n'
import { ContextMenu, type MenuItem } from '../../shell/ContextMenu'

type Align = 'left' | 'center' | 'right' | null

// İmleç tablodayken tablonun sağ üstünde küçük bir düğme belirir; araç çubuğu yalnızca ona basınca açılır
export function TableMenu({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false)
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null)

  // hücreye sağ tık: imleç o hücreye gider ve tablo menüsü açılır
  useEffect(() => {
    const dom = editor.view.dom
    const onContext = (e: MouseEvent) => {
      if (!editor.isEditable) return
      const cell = (e.target as HTMLElement | null)?.closest('td, th')
      if (!cell || !dom.contains(cell)) return
      e.preventDefault()
      const at = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
      if (at) editor.chain().focus().setTextSelection(at.pos).run()
      setCtx({ x: e.clientX, y: e.clientY })
    }
    dom.addEventListener('contextmenu', onContext)
    return () => dom.removeEventListener('contextmenu', onContext)
  }, [editor])

  // tablodan çıkınca menü kapanır; bir sonraki tabloya girişte yine yalnızca düğme görünür
  useEffect(() => {
    const onSel = () => {
      if (!editor.isActive('table')) setOpen(false)
    }
    editor.on('selectionUpdate', onSel)
    return () => {
      editor.off('selectionUpdate', onSel)
    }
  }, [editor])

  // açılıp kapanınca genişlik değişir: konumun yeniden hesaplanması için boş bir güncelleme
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta('tableMenu', 'updatePosition'))
    })
    return () => cancelAnimationFrame(id)
  }, [open, editor])

  const setAlign = (align: Align) => {
    editor.chain().focus().setCellAttribute('align', align).run()
  }
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => () => {
    fn(editor.chain().focus()).run()
  }
  const items: MenuItem[] = [
    { label: tNow('table.rowAbove'), onSelect: run((c) => c.addRowBefore()) },
    { label: tNow('table.rowBelow'), onSelect: run((c) => c.addRowAfter()) },
    { label: tNow('table.colLeft'), onSelect: run((c) => c.addColumnBefore()), separatorBefore: true },
    { label: tNow('table.colRight'), onSelect: run((c) => c.addColumnAfter()) },
    { label: tNow('table.headerRow'), onSelect: run((c) => c.toggleHeaderRow()), separatorBefore: true },
    { label: tNow('table.alignLeft'), onSelect: () => setAlign('left'), separatorBefore: true },
    { label: tNow('table.alignCenter'), onSelect: () => setAlign('center') },
    { label: tNow('table.alignRight'), onSelect: () => setAlign('right') },
    { label: tNow('table.removeRow'), onSelect: run((c) => c.deleteRow()), separatorBefore: true, danger: true },
    { label: tNow('table.removeColumn'), onSelect: run((c) => c.deleteColumn()), danger: true },
    { label: tNow('table.delete'), onSelect: run((c) => c.deleteTable()), danger: true }
  ]
  return (
    <>
    {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={items} onClose={() => setCtx(null)} />}
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      shouldShow={({ editor: e }) => e.isEditable && e.isActive('table')}
      options={{ placement: 'top-end', offset: 6 }}
      // imlecin değil tablonun sağ üst köşesine bağlanır: başlık satırını örtmez
      getReferencedVirtualElement={() => {
        const { from } = editor.state.selection
        const dom = editor.view.domAtPos(from).node
        const el = (dom instanceof HTMLElement ? dom : dom.parentElement)?.closest('table')
        return el ? { getBoundingClientRect: () => el.getBoundingClientRect(), contextElement: el } : null
      }}
      className={open ? 'table-menu glass glass-pop' : 'table-menu-toggle-wrap'}
    >
      {open ? (
        <>
          <button data-testid="table-add-row" onClick={() => editor.chain().focus().addRowAfter().run()}>{tNow('table.addRow')}</button>
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
          <button className="table-menu-close" title={tNow('table.closeMenu')} aria-label={tNow('table.closeMenu')} onClick={() => setOpen(false)}>
            ×
          </button>
        </>
      ) : (
        <button
          className="table-menu-toggle glass"
          data-testid="table-menu-toggle"
          title={tNow('table.openMenu')}
          aria-label={tNow('table.openMenu')}
          // tıklama imleci hücreden almasın
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setOpen(true)}
        >
          ⋯
        </button>
      )}
    </BubbleMenu>
    </>
  )
}
