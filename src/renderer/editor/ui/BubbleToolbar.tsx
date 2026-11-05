import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { NodeSelection } from '@tiptap/pm/state'
import { ContextMenu } from '../../shell/ContextMenu'
import { tNow } from '../../lib/i18n'
import type { MessageKey } from '@shared/i18n'

export const HIGHLIGHT_COLORS: { id: string | null; label: MessageKey }[] = [
  { id: 'yellow', label: 'color.yellow' },
  { id: 'green', label: 'color.green' },
  { id: 'blue', label: 'color.blue' },
  { id: 'pink', label: 'color.pink' },
  { id: 'purple', label: 'color.purple' },
  { id: 'gray', label: 'color.gray' },
  { id: null, label: 'bubble.removeHighlight' }
]

// Metin seçilince beliren cam biçim araç çubuğu
export function BubbleToolbar({ editor }: { editor: Editor }) {
  const [colorMenu, setColorMenu] = useState<{ x: number; y: number } | null>(null)
  const btn = (id: string, label: string, title: string, active: boolean, run: () => void) => (
    <button data-testid={`bubble-${id}`} className={active ? 'active' : ''} title={title} onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {label}
    </button>
  )
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="bubbleToolbar"
      shouldShow={({ editor: e, from, to, state }) => e.isEditable && from !== to && !(state.selection instanceof NodeSelection && state.selection.node.isBlock) && !e.isActive('codeBlock') && !e.isActive('image') && !e.isActive('blockMath')}
      options={{ placement: 'top' }}
      className="bubble-toolbar glass glass-pop"
      data-testid="bubble-toolbar"
    >
      {btn('bold', 'B', tNow('bubble.bold'), editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
      {btn('italic', 'I', tNow('bubble.italic'), editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
      {btn('underline', 'U', tNow('bubble.underline'), editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}
      {btn('strike', 'S', tNow('bubble.strike'), editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run())}
      {btn('code', '</>', tNow('bubble.code'), editor.isActive('code'), () => editor.chain().focus().toggleCode().run())}
      {btn('math', '∑', tNow('bubble.math'), false, () => {
        const { from, to } = editor.state.selection
        const latex = editor.state.doc.textBetween(from, to)
        editor.chain().focus().deleteSelection().insertContent({ type: 'inlineMath', attrs: { latex } }).run()
      })}
      {btn('link', '🔗', tNow('bubble.link'), editor.isActive('link'), () => {
        const prev = editor.getAttributes('link')['href'] as string | undefined
        const url = window.prompt('Link adresi', prev ?? 'https://')
        if (url === null) return
        if (!url.trim()) editor.chain().focus().unsetLink().run()
        else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
      })}
      <button
        data-testid="bubble-highlight"
        title={tNow('bubble.highlight')}
        className={editor.isActive('highlight') ? 'active' : ''}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setColorMenu({ x: r.left, y: r.bottom + 4 })
        }}
      >
        <span className="hl-swatch" />
      </button>
      {colorMenu && (
        <ContextMenu
          x={colorMenu.x}
          y={colorMenu.y}
          onClose={() => setColorMenu(null)}
          items={[
            ...HIGHLIGHT_COLORS.map((c) => ({ label: tNow(c.label), onSelect: () => editor.chain().focus().setHighlight(c.id ? { color: c.id } : { color: null as unknown as string }).run() })),
            { label: tNow('bubble.removeHighlight'), separatorBefore: true, onSelect: () => editor.chain().focus().unsetHighlight().run() }
          ]}
        />
      )}
    </BubbleMenu>
  )
}
