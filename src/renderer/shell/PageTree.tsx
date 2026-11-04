import { useState, type DragEvent } from 'react'
import type { TreeNode } from '@shared/types'
import { useStore } from '../state/store'
import { kernel } from '../lib/kernel'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { PageIcon } from './PageHeader'

type DropZone = 'before' | 'inside' | 'after'

interface DragState {
  id: string | null
  over: { id: string; zone: DropZone } | null
}

// Kenar çubuğundaki sayfa ağacı: aç/kapa, yeniden adlandır, alt sayfa, sağ tık menüsü, sürükle-bırak
export function PageTree({ onRequestIcon, onRequestExport }: { onRequestIcon(id: string): void; onRequestExport(id: string): void }) {
  const tree = useStore((s) => s.tree)
  const [drag, setDrag] = useState<DragState>({ id: null, over: null })
  const [menu, setMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null)

  const parentOf = (id: string, nodes: TreeNode[] = tree, parent: TreeNode | null = null): { parent: TreeNode | null; index: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i]!.id === id) return { parent, index: i }
      const r = parentOf(id, nodes[i]!.children, nodes[i]!)
      if (r) return r
    }
    return null
  }

  const drop = async (targetId: string, zone: DropZone) => {
    const id = drag.id
    setDrag({ id: null, over: null })
    if (!id || id === targetId) return
    const store = useStore.getState()
    try {
      if (zone === 'inside') {
        await kernel.pages.move(id, targetId, Number.MAX_SAFE_INTEGER)
        store.setExpanded(targetId, true)
      } else {
        const loc = parentOf(targetId)
        if (!loc) return
        const index = zone === 'before' ? loc.index : loc.index + 1
        await kernel.pages.move(id, loc.parent?.id ?? null, index)
      }
      await store.refreshTree()
    } catch (e) {
      store.toast(e instanceof Error ? e.message : 'Sayfa taşınamadı', 'error')
    }
  }

  const menuItems = (node: TreeNode): MenuItem[] => {
    const s = useStore.getState()
    return [
      { label: 'Yeni alt sayfa', onSelect: () => void s.createPage(node.id) },
      { label: 'Yeniden adlandır', onSelect: () => s.setRenaming(node.id) },
      { label: 'İkon değiştir', onSelect: () => onRequestIcon(node.id) },
      { label: "Finder'da göster", onSelect: () => void kernel.vault.reveal(node.id) },
      { label: 'PDF olarak dışa aktar', onSelect: () => onRequestExport(node.id) },
      {
        label: 'Şablon olarak kaydet',
        onSelect: async () => {
          const saved = await kernel.templates.saveAs(node.id, node.title)
          s.toast(`"${saved}" şablonu kaydedildi`)
        }
      },
      {
        label: 'Sürüm geçmişi',
        onSelect: () => {
          s.openPage(node.id)
          s.setOverlay('history')
        }
      },
      {
        label: 'Çöp kutusuna taşı',
        danger: true,
        separatorBefore: true,
        onSelect: async () => {
          await kernel.pages.trash(node.id)
          await s.refreshTree()
          s.toast(`"${node.title}" çöp kutusuna taşındı`)
        }
      }
    ]
  }

  return (
    <div className="tree" role="tree">
      {tree.map((n) => (
        <Row key={n.id} node={n} depth={0} drag={drag} setDrag={setDrag} onDrop={drop} onMenu={(x, y, node) => setMenu({ x, y, node })} />
      ))}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.node)} onClose={() => setMenu(null)} />}
    </div>
  )
}

function Row({
  node,
  depth,
  drag,
  setDrag,
  onDrop,
  onMenu
}: {
  node: TreeNode
  depth: number
  drag: DragState
  setDrag(d: DragState): void
  onDrop(targetId: string, zone: DropZone): void
  onMenu(x: number, y: number, node: TreeNode): void
}) {
  const currentId = useStore((s) => s.currentId)
  const open = useStore((s) => s.expanded[node.id] ?? false)
  const renaming = useStore((s) => s.renamingId === node.id)
  const hasChildren = node.children.length > 0

  const zoneOf = (e: DragEvent<HTMLDivElement>): DropZone => {
    const r = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - r.top
    if (y < r.height * 0.25) return 'before'
    if (y > r.height * 0.75) return 'after'
    return 'inside'
  }
  const over = drag.over?.id === node.id ? drag.over.zone : null

  return (
    <>
      <div
        className={`tree-row${currentId === node.id ? ' active' : ''}${over ? ` drop-${over}` : ''}`}
        data-testid="tree-row"
        role="treeitem"
        aria-expanded={hasChildren ? open : undefined}
        style={{ paddingLeft: 4 + depth * 14 }}
        draggable={!renaming}
        onClick={() => useStore.getState().openPage(node.id)}
        onDoubleClick={() => useStore.getState().setRenaming(node.id)}
        onContextMenu={(e) => {
          e.preventDefault()
          onMenu(e.clientX, e.clientY, node)
        }}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', node.id)
          setDrag({ id: node.id, over: null })
        }}
        onDragOver={(e) => {
          if (!drag.id || drag.id === node.id) return
          e.preventDefault()
          const zone = zoneOf(e)
          if (drag.over?.id !== node.id || drag.over.zone !== zone) setDrag({ ...drag, over: { id: node.id, zone } })
        }}
        onDragLeave={() => {
          if (drag.over?.id === node.id) setDrag({ ...drag, over: null })
        }}
        onDrop={(e) => {
          e.preventDefault()
          onDrop(node.id, zoneOf(e))
        }}
        onDragEnd={() => setDrag({ id: null, over: null })}
      >
        <span
          className={`tree-chevron${open ? ' open' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) useStore.getState().setExpanded(node.id, !open)
          }}
        >
          {hasChildren ? '▶' : ''}
        </span>
        <span className="tree-icon">{node.icon ? <PageIcon icon={node.icon} size={16} /> : '📄'}</span>
        {renaming ? (
          <RenameInput node={node} />
        ) : (
          <span className="tree-title">{node.title}</span>
        )}
        <span className="row-actions">
          <button
            className="icon-btn"
            data-testid="add-child"
            title="Alt sayfa ekle"
            onClick={(e) => {
              e.stopPropagation()
              void useStore.getState().createPage(node.id)
            }}
          >
            +
          </button>
        </span>
      </div>
      {open && node.children.map((c) => <Row key={c.id} node={c} depth={depth + 1} drag={drag} setDrag={setDrag} onDrop={onDrop} onMenu={onMenu} />)}
    </>
  )
}

function RenameInput({ node }: { node: TreeNode }) {
  const [value, setValue] = useState(node.title)
  const done = async (commit: boolean) => {
    const s = useStore.getState()
    s.setRenaming(null)
    if (commit && value.trim() && value !== node.title) {
      await kernel.pages.rename(node.id, value.trim())
      await s.refreshTree()
    }
  }
  return (
    <input
      className="rename-input"
      data-testid="rename-input"
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void done(true)
        if (e.key === 'Escape') void done(false)
      }}
      onBlur={() => void done(true)}
    />
  )
}
