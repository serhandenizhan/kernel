import { useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { CalloutType } from '@core/markdown/schema'
import { CALLOUT_DEFAULT_ICON, CALLOUT_LABEL, CALLOUT_TYPES } from '../nodes/Callout'
import { ContextMenu } from '../../shell/ContextMenu'

// Callout: ikona tıklayınca tür / ikon / başlık menüsü
export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const type = node.attrs['type'] as CalloutType
  const icon = (node.attrs['icon'] as string | null) ?? CALLOUT_DEFAULT_ICON[type]
  const title = String(node.attrs['title'] ?? '')
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  return (
    <NodeViewWrapper className={`callout callout-${type}`} data-callout={type}>
      <button
        className="callout-icon"
        contentEditable={false}
        title="Callout türünü değiştir"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setMenu({ x: r.left, y: r.bottom + 4 })
        }}
      >
        {icon}
      </button>
      <div className="callout-body">
        {title !== '' && (
          <input className="callout-title" contentEditable={false} value={title} placeholder="Başlık" onChange={(e) => updateAttributes({ title: e.target.value })} />
        )}
        <NodeViewContent className="callout-content" />
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            ...CALLOUT_TYPES.map((t) => ({ label: `${CALLOUT_DEFAULT_ICON[t]}  ${CALLOUT_LABEL[t]}`, onSelect: () => updateAttributes({ type: t, icon: null }) })),
            {
              label: 'Özel ikon…',
              separatorBefore: true,
              onSelect: () => {
                const v = window.prompt('İkon olarak bir emoji gir', icon)
                if (v) updateAttributes({ icon: [...v.trim()][0] ?? null })
              }
            },
            { label: title === '' ? 'Başlık ekle' : 'Başlığı kaldır', onSelect: () => updateAttributes({ title: title === '' ? CALLOUT_LABEL[type] : '' }) }
          ]}
        />
      )}
    </NodeViewWrapper>
  )
}
