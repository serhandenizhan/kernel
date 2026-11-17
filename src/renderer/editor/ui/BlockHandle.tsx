import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { NodeSelection } from '@tiptap/pm/state'
import { ContextMenu, type MenuItem } from '../../shell/ContextMenu'
import { tNow } from '../../lib/i18n'
import type { MessageKey } from '@shared/i18n'
import { Icon } from '../../assets/icons'
import { BLOCK_TYPES, currentBlockType } from '../block-types'

interface Target {
  pos: number
  top: number
}

// Satırın solunda tutamak (altı nokta): sürükle-bırak ile blok taşıma, tıklayınca blok menüsü
export function BlockHandle({ editor, container }: { editor: Editor; container: HTMLElement | null }) {
  const [target, setTarget] = useState<Target | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; pos: number; header: string; turnable: boolean } | null>(null)
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

  // tablo, görsel gibi metin olmayan bloklar için başlık satırında gösterilecek ad
  const otherLabel = (name: string): string => {
    const map: Record<string, MessageKey> = { table: 'block.type.table', image: 'block.type.image', callout: 'block.type.callout', blockMath: 'block.type.math', details: 'block.type.toggle', pdfEmbed: 'block.type.pdf', horizontalRule: 'block.type.divider' }
    return tNow(map[name] ?? 'block.type.block')
  }

  const open = (x: number, y: number, pos: number) => {
    const node = editor.state.doc.nodeAt(pos)
    if (!node) return
    // metin bloklarında imleci bloğa koy: tür okunur ve "Dönüştür" o bloğa uygulanır
    if (node.isTextblock || ['bulletList', 'orderedList', 'taskList', 'blockquote'].includes(node.type.name)) {
      editor.commands.setTextSelection(Math.min(pos + (node.isTextblock ? 1 : 3), editor.state.doc.content.size))
    }
    const type = node.isTextblock || ['bulletList', 'orderedList', 'taskList', 'blockquote'].includes(node.type.name) ? currentBlockType(editor) : null
    setMenu({ x, y, pos, header: type ? type.label() : otherLabel(node.type.name), turnable: !!type })
  }

  const items = (pos: number, turnable: boolean): MenuItem[] => {
    const block = editor.state.doc.nodeAt(pos)
    // toggle: başlık = soru, içerik = cevap olan flashcard'a çevrilebilir (spec §12)
    const cardItem: MenuItem[] =
      block?.type.name === 'details'
        ? [
            {
              label: tNow(block.attrs['card'] ? 'block.unmarkCard' : 'block.markCard'),
              icon: 'card',
              onSelect: () => {
                editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, 'card', !block.attrs['card']))
              }
            }
          ]
        : []
    const turnInto: MenuItem[] = turnable
      ? [
          {
            label: tNow('block.turnInto'),
            icon: 'turn-into',
            onSelect: () => undefined,
            submenu: BLOCK_TYPES.map((t) => ({ label: t.label(), icon: t.icon, checked: t.active(editor), onSelect: () => t.apply(editor) }))
          }
        ]
      : []
    return [
      ...turnInto,
      ...cardItem,
      {
        label: tNow('block.duplicate'),
        icon: 'duplicate',
        separatorBefore: turnInto.length + cardItem.length > 0,
        onSelect: () => {
          const node = editor.state.doc.nodeAt(pos)
          if (node) editor.chain().focus().insertContentAt(pos + node.nodeSize, node.toJSON()).run()
        }
      },
      {
        label: tNow('block.delete'),
        icon: 'trash',
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
        onClick={(e) => open(e.clientX, e.clientY, target.pos)}
      >
        <Icon name="grip" size={14} />
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} header={menu.header} items={items(menu.pos, menu.turnable)} onClose={() => setMenu(null)} />}
    </>
  )
}
