import { useEffect, useReducer, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { NodeSelection } from '@tiptap/pm/state'
import { ContextMenu } from '../../shell/ContextMenu'
import { tNow } from '../../lib/i18n'
import type { MessageKey } from '@shared/i18n'
import { Icon, type IconName } from '../../assets/icons'
import { BLOCK_TYPES, currentBlockType } from '../block-types'

// vurgu renkleri; swatch: menüdeki renk örneği (açık temadaki vurgu rengi)
export const HIGHLIGHT_COLORS: { id: string | null; label: MessageKey; swatch?: string }[] = [
  { id: 'yellow', label: 'color.yellow', swatch: '#fff3a3' },
  { id: 'green', label: 'color.green', swatch: '#c9f0d8' },
  { id: 'blue', label: 'color.blue', swatch: '#cfe5ff' },
  { id: 'pink', label: 'color.pink', swatch: '#ffd6e7' },
  { id: 'purple', label: 'color.purple', swatch: '#e5d9ff' },
  { id: 'gray', label: 'color.gray', swatch: '#e3e8ec' },
  { id: null, label: 'bubble.removeHighlight' }
]

// Metin seçilince beliren cam biçim araç çubuğu
export function BubbleToolbar({ editor }: { editor: Editor }) {
  const [colorMenu, setColorMenu] = useState<{ x: number; y: number } | null>(null)
  const [typeMenu, setTypeMenu] = useState<{ x: number; y: number } | null>(null)
  // seçim / biçim değişince yeniden çiz: tür adı ve etkin düğmeler güncel kalsın
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    // 'transaction' dinlenmez: menünün kendi konum güncellemeleri de işlem gönderir, sonsuz döngü olur
    editor.on('selectionUpdate', rerender)
    editor.on('update', rerender)
    return () => {
      editor.off('selectionUpdate', rerender)
      editor.off('update', rerender)
    }
  }, [editor])
  // ikonlu düğme; data-tip: üzerine gelince hemen beliren açıklama (kısayoluyla)
  const btn = (id: string, icon: IconName, tip: string, active: boolean, run: () => void) => (
    <button data-testid={`bubble-${id}`} className={`has-tip${active ? ' active' : ''}`} data-tip={tip} aria-label={tip} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      <Icon name={icon} size={15} />
    </button>
  )
  const type = currentBlockType(editor)
  const activeColor = HIGHLIGHT_COLORS.find((c) => c.id && editor.isActive('highlight', { color: c.id }))
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="bubbleToolbar"
      shouldShow={({ editor: e, from, to, state }) => e.isEditable && from !== to && !(state.selection instanceof NodeSelection && state.selection.node.isBlock) && !e.isActive('codeBlock') && !e.isActive('image') && !e.isActive('blockMath')}
      options={{ placement: 'top' }}
      className="bubble-toolbar glass glass-pop"
      data-testid="bubble-toolbar"
    >
      {type && (
        <>
          <button
            className="bubble-type has-tip"
            data-testid="bubble-type"
            data-tip={tNow('bubble.turnInto')}
            aria-label={tNow('bubble.turnInto')}
            aria-expanded={!!typeMenu}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setTypeMenu({ x: r.left, y: r.bottom + 6 })
            }}
          >
            <Icon name={type.icon} size={15} />
            <span>{type.label()}</span>
            <Icon name="chevron-down" size={11} />
          </button>
          <span className="bubble-sep" />
        </>
      )}
      {btn('bold', 'bold', tNow('bubble.bold'), editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
      {btn('italic', 'italic', tNow('bubble.italic'), editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
      {btn('underline', 'underline', tNow('bubble.underline'), editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}
      {btn('strike', 'strike', tNow('bubble.strike'), editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run())}
      {btn('code', 'code', tNow('bubble.code'), editor.isActive('code'), () => editor.chain().focus().toggleCode().run())}
      {btn('math', 'sigma', tNow('bubble.math'), false, () => {
        const { from, to } = editor.state.selection
        const latex = editor.state.doc.textBetween(from, to)
        editor.chain().focus().deleteSelection().insertContent({ type: 'inlineMath', attrs: { latex } }).run()
      })}
      {btn('link', 'link', tNow('bubble.link'), editor.isActive('link'), () => {
        const prev = editor.getAttributes('link')['href'] as string | undefined
        const url = window.prompt('Link adresi', prev ?? 'https://')
        if (url === null) return
        if (!url.trim()) editor.chain().focus().unsetLink().run()
        else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
      })}
      <span className="bubble-sep" />
      <button
        data-testid="bubble-highlight"
        data-tip={tNow('bubble.highlight')}
        aria-label={tNow('bubble.highlight')}
        aria-expanded={!!colorMenu}
        className={`has-tip bubble-color${editor.isActive('highlight') ? ' active' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setColorMenu({ x: r.left, y: r.bottom + 4 })
        }}
      >
        <Icon name="highlight" size={15} />
        {/* seçili metnin vurgu rengi (yoksa sarı önerisi soluk) */}
        <span className="bubble-color-bar" style={{ background: activeColor?.swatch ?? '#f5d75b', opacity: activeColor ? 1 : 0.55 }} />
      </button>
      {typeMenu && (
        <ContextMenu
          x={typeMenu.x}
          y={typeMenu.y}
          header={tNow('block.turnInto')}
          onClose={() => setTypeMenu(null)}
          items={BLOCK_TYPES.map((t) => ({ label: t.label(), icon: t.icon, checked: t.active(editor), onSelect: () => t.apply(editor) }))}
        />
      )}
      {colorMenu && (
        <ContextMenu
          x={colorMenu.x}
          y={colorMenu.y}
          onClose={() => setColorMenu(null)}
          items={[
            ...HIGHLIGHT_COLORS.filter((c) => c.id).map((c) => ({ label: tNow(c.label), swatch: c.swatch, checked: activeColor?.id === c.id, onSelect: () => editor.chain().focus().setHighlight({ color: c.id! }).run() })),
            { label: tNow('bubble.removeHighlight'), icon: 'close' as const, separatorBefore: true, onSelect: () => editor.chain().focus().unsetHighlight().run() }
          ]}
        />
      )}
    </BubbleMenu>
  )
}
