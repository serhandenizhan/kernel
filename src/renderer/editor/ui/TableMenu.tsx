import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { tNow } from '../../lib/i18n'
import { Icon, type IconName } from '../../assets/icons'
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
  // ikonlu tablo düğmesi; data-tip üzerine gelince beliren açıklama
  const tbtn = (id: string, icon: IconName, tip: string, fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']> | null, custom?: () => void, danger = false) => (
    <button
      key={id}
      data-testid={id}
      className={`has-tip${danger ? ' danger' : ''}`}
      data-tip={tip}
      aria-label={tip}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (custom) return custom()
        fn(editor.chain().focus())?.run()
      }}
    >
      <Icon name={icon} size={15} />
    </button>
  )
  const items: MenuItem[] = [
    { label: tNow('table.rowAbove'), icon: 'row-above', onSelect: run((c) => c.addRowBefore()) },
    { label: tNow('table.rowBelow'), icon: 'row-below', onSelect: run((c) => c.addRowAfter()) },
    { label: tNow('table.colLeft'), icon: 'col-left', onSelect: run((c) => c.addColumnBefore()), separatorBefore: true },
    { label: tNow('table.colRight'), icon: 'col-right', onSelect: run((c) => c.addColumnAfter()) },
    { label: tNow('table.headerRow'), icon: 'table-header', onSelect: run((c) => c.toggleHeaderRow()), separatorBefore: true },
    { label: tNow('table.alignLeft'), icon: 'align-left', onSelect: () => setAlign('left'), separatorBefore: true },
    { label: tNow('table.alignCenter'), icon: 'align-center', onSelect: () => setAlign('center') },
    { label: tNow('table.alignRight'), icon: 'align-right', onSelect: () => setAlign('right') },
    { label: tNow('table.removeRow'), icon: 'row-remove', onSelect: run((c) => c.deleteRow()), separatorBefore: true, danger: true },
    { label: tNow('table.removeColumn'), icon: 'col-remove', onSelect: run((c) => c.deleteColumn()), danger: true },
    { label: tNow('table.delete'), icon: 'trash', onSelect: run((c) => c.deleteTable()), danger: true }
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
          {tbtn('table-add-row', 'row-below', tNow('table.tip.addRow'), (c) => c.addRowAfter())}
          {tbtn('table-add-col', 'col-right', tNow('table.tip.addColumn'), (c) => c.addColumnAfter())}
          {tbtn('table-del-row', 'row-remove', tNow('table.tip.deleteRow'), (c) => c.deleteRow())}
          {tbtn('table-del-col', 'col-remove', tNow('table.tip.deleteColumn'), (c) => c.deleteColumn())}
          <span className="sep" />
          {tbtn('table-align-left', 'align-left', tNow('table.alignLeft'), () => null, () => setAlign('left'))}
          {tbtn('table-align-center', 'align-center', tNow('table.alignCenter'), () => null, () => setAlign('center'))}
          {tbtn('table-align-right', 'align-right', tNow('table.alignRight'), () => null, () => setAlign('right'))}
          {tbtn('table-header-row', 'table-header', tNow('table.headerRow'), (c) => c.toggleHeaderRow())}
          <span className="sep" />
          {tbtn('table-delete', 'trash', tNow('table.delete'), (c) => c.deleteTable(), undefined, true)}
          {tbtn('table-menu-close', 'close', tNow('table.closeMenu'), () => null, () => setOpen(false))}
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
          <Icon name="grid" size={14} />
          <span>⋯</span>
        </button>
      )}
    </BubbleMenu>
    </>
  )
}
