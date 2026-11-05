import { useState } from 'react'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { ContextMenu } from './ContextMenu'
import { tNow } from '../lib/i18n'

// "+" yanındaki ▾: şablondan yeni sayfa
export function TemplateMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; names: string[] } | null>(null)
  return (
    <>
      <button
        className="icon-btn"
        data-testid="template-menu"
        title={tNow('sidebar.fromTemplate')}
        onClick={async (e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setMenu({ x: r.left, y: r.bottom + 4, names: await kernel.templates.list() })
        }}
      >
        ▾
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={menu.names.map((name) => ({
            label: name,
            onSelect: async () => {
              const s = useStore.getState()
              const node = await kernel.templates.create(null, name)
              await s.refreshTree()
              s.openPage(node.id)
            }
          }))}
        />
      )}
    </>
  )
}
