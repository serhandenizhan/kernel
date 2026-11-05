import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { ContextMenu, type MenuItem } from '../../shell/ContextMenu'
import { tNow } from '../../lib/i18n'

interface Target {
  pos: number
  top: number
}

// Satırın solunda ⋮⋮ tutamağı: sürükle-bırak ile blok taşıma, tıklayınca blok menüsü
export function BlockHandle({ editor, container }: { editor: Editor; container: HTMLElement | null }) {
  const [target, setTarget] = useState<Target | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; pos: number } | null>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container) return
    const onMove = (e: MouseEvent) => {
      if (handleRef.current?.contains(e.target as Node)) return
      const view = editor.view
      const box = view.dom.getBoundingClientRect()
      if (e.clientY < box.top || e.clientY > box.bottom) return
      const hit = view.posAtCoords({ left: box.left + 8, top: e.clientY })
      if (!hit) return
      const $pos = view.state.doc.resolve(hit.pos)
      if ($pos.depth < 1 && !view.state.doc.nodeAt(hit.pos)) return
      const pos = $pos.depth >= 1 ? $pos.before(1) : hit.pos
      const dom = view.nodeDOM(pos) as HTMLElement | null
      if (!dom || !(dom instanceof HTMLElement)) return
      const cRect = container.getBoundingClientRect()
      const r = dom.getBoundingClientRect()
      const lineHeight = parseFloat(getComputedStyle(dom).lineHeight) || 24
      setTarget({ pos, top: r.top - cRect.top + Math.min(r.height, lineHeight) / 2 - 11 })
    }
    container.addEventListener('mousemove', onMove)
    return () => container.removeEventListener('mousemove', onMove)
  }, [editor, container])

  if (!target || !editor.isEditable) return null

  const onDragStart = (e: React.DragEvent) => {
    const view = editor.view
    const sel = NodeSelection.create(view.state.doc, target.pos)
    view.dispatch(view.state.tr.setSelection(sel))
    const slice = sel.content()
    // ProseMirror'ın kendi sürükle-bırak akışını kullan (move: true → kaynak silinir)
    ;(view as unknown as { dragging: unknown }).dragging = { slice, move: true }
    const dom = view.nodeDOM(target.pos) as HTMLElement | null
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', view.state.doc.textBetween(sel.from, sel.to, '\n'))
    if (dom) e.dataTransfer.setDragImage(dom, 0, 0)
  }

  const items = (pos: number): MenuItem[] => {
    const chainAt = () => editor.chain().focus().setNodeSelection(pos)
    const turn = (label: string, run: () => void): MenuItem => ({ label, onSelect: run })
    const block = editor.state.doc.nodeAt(pos)
    // toggle: başlık = soru, içerik = cevap olan flashcard'a çevrilebilir (spec §12)
    const cardItem: MenuItem[] =
      block?.type.name === 'details'
        ? [
            {
              label: tNow(block.attrs['card'] ? 'block.unmarkCard' : 'block.markCard'),
              onSelect: () => {
                editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'card', !block.attrs['card']))
              }
            }
          ]
        : []
    return [
      ...cardItem,
      turn(tNow('block.toText'), () => chainAt().setTextSelection(pos + 1).setParagraph().run()),
      turn(tNow('slash.heading', { level: 1 }), () => chainAt().setTextSelection(pos + 1).setNode('heading', { level: 1 }).run()),
      turn(tNow('slash.heading', { level: 2 }), () => chainAt().setTextSelection(pos + 1).setNode('heading', { level: 2 }).run()),
      turn(tNow('slash.heading', { level: 3 }), () => chainAt().setTextSelection(pos + 1).setNode('heading', { level: 3 }).run()),
      turn(tNow('slash.bullet'), () => chainAt().setTextSelection(pos + 1).toggleBulletList().run()),
      turn(tNow('slash.quote'), () => chainAt().setTextSelection(pos + 1).toggleBlockquote().run()),
      {
        label: tNow('block.duplicate'),
        separatorBefore: true,
        onSelect: () => {
          const node = editor.state.doc.nodeAt(pos)
          if (node) editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run()
        }
      },
      {
        label: tNow('block.delete'),
        danger: true,
        onSelect: () => {
          const node = editor.state.doc.nodeAt(pos)
          if (node) editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
        }
      }
    ]
  }

  return (
    <>
      <div
        ref={handleRef}
        className="block-handle"
        data-testid="block-handle"
        draggable
        title={tNow('block.handle')}
        style={{ top: target.top }}
        onDragStart={onDragStart}
        onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, pos: target.pos })}
      >
        ⋮⋮
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={items(menu.pos)} onClose={() => setMenu(null)} />}
    </>
  )
}
