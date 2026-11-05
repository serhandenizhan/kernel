import { useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { CalloutType } from '@core/markdown/schema'
import { CALLOUT_DEFAULT_ICON, calloutLabel, CALLOUT_TYPES } from '../nodes/Callout'
import { ContextMenu } from '../../shell/ContextMenu'
import { tNow } from '../../lib/i18n'

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
        title={tNow('callout.changeType')}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setMenu({ x: r.left, y: r.bottom + 4 })
        }}
      >
        {icon}
      </button>
      <div className="callout-body">
        {title !== '' && (
          <input className="callout-title" contentEditable={false} value={title} placeholder={tNow('callout.titlePlaceholder')} onChange={(e) => updateAttributes({ title: e.target.value })} />
        )}
        <NodeViewContent className="callout-content" />
      </div>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            ...CALLOUT_TYPES.map((t) => ({ label: `${CALLOUT_DEFAULT_ICON[t]}  ${calloutLabel(t)}`, onSelect: () => updateAttributes({ type: t, icon: null }) })),
            {
              label: tNow('callout.customIcon'),
              separatorBefore: true,
              onSelect: () => {
                const v = window.prompt(tNow('callout.iconPrompt'), icon)
                if (v) updateAttributes({ icon: [...v.trim()][0] ?? null })
              }
            },
            { label: title === '' ? tNow('callout.addTitle') : tNow('callout.removeTitle'), onSelect: () => updateAttributes({ title: title === '' ? calloutLabel(type) : '' }) }
          ]}
        />
      )}
    </NodeViewWrapper>
  )
}
