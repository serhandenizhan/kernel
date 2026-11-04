import { useState } from 'react'
import type { Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { ContextMenu } from '../../shell/ContextMenu'

export const HIGHLIGHT_COLORS: { id: string | null; label: string }[] = [
  { id: 'yellow', label: 'Sarı' },
  { id: 'green', label: 'Yeşil' },
  { id: 'blue', label: 'Mavi' },
  { id: 'pink', label: 'Pembe' },
  { id: 'purple', label: 'Mor' },
  { id: 'gray', label: 'Gri' },
  { id: null, label: 'Renksiz vurgu' }
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
      shouldShow={({ editor: e, from, to }) => e.isEditable && from !== to && !e.isActive('codeBlock') && !e.isActive('image') && !e.isActive('blockMath')}
      options={{ placement: 'top' }}
      className="bubble-toolbar glass"
      data-testid="bubble-toolbar"
    >
      {btn('bold', 'B', 'Kalın (⌘B)', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
      {btn('italic', 'I', 'İtalik (⌘I)', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
      {btn('underline', 'U', 'Altı çizili (⌘U)', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run())}
      {btn('strike', 'S', 'Üstü çizili (⌘⇧S)', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run())}
      {btn('code', '</>', 'Kod', editor.isActive('code'), () => editor.chain().focus().toggleCode().run())}
      {btn('math', '∑', 'Satır içi formül (⌘⇧M)', false, () => {
        const { from, to } = editor.state.selection
        const latex = editor.state.doc.textBetween(from, to)
        editor.chain().focus().deleteSelection().insertContent({ type: 'inlineMath', attrs: { latex } }).run()
      })}
      {btn('link', '🔗', 'Link', editor.isActive('link'), () => {
        const prev = editor.getAttributes('link')['href'] as string | undefined
        const url = window.prompt('Link adresi', prev ?? 'https://')
        if (url === null) return
        if (!url.trim()) editor.chain().focus().unsetLink().run()
        else editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
      })}
      <button
        data-testid="bubble-highlight"
        title="Vurgu rengi"
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
            ...HIGHLIGHT_COLORS.map((c) => ({ label: c.label, onSelect: () => editor.chain().focus().setHighlight(c.id ? { color: c.id } : { color: null as unknown as string }).run() })),
            { label: 'Vurguyu kaldır', separatorBefore: true, onSelect: () => editor.chain().focus().unsetHighlight().run() }
          ]}
        />
      )}
    </BubbleMenu>
  )
}
