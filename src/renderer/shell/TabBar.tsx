import type { TreeNode } from '@shared/types'
import { useStore } from '../state/store'
import { useT } from '../lib/i18n'
import { Icon } from '../assets/icons'
import { PageIcon } from './PageHeader'

function find(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const c = find(n.children, id)
    if (c) return c
  }
  return null
}

/** Sürüklenen sekmenin sayfa kimliği (bölünmüş ekran bırakma alanı okur) */
export const TAB_MIME = 'application/x-kernel-tab'

// Sekme çubuğu (spec §12): birden fazla sekme varken görünür; sekme sayfanın sağına sürüklenince ekran bölünür
export function TabBar() {
  const t = useT()
  const tabs = useStore((s) => s.tabs)
  const active = useStore((s) => s.activeTab)
  const view = useStore((s) => s.view)
  const tree = useStore((s) => s.tree)
  if (tabs.length < 2) return null
  return (
    <div className="tab-bar" role="tablist" aria-label={t('tabs.label')}>
      {tabs.map((id, i) => {
        const node = find(tree, id)
        return (
          <div
            key={`${id}:${i}`}
            role="tab"
            aria-selected={view === 'page' && i === active}
            className={`tab${view === 'page' && i === active ? ' active' : ''}`}
            data-testid="tab"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(TAB_MIME, id)
              e.dataTransfer.effectAllowed = 'move'
              document.body.classList.add('dragging-tab')
            }}
            onDragEnd={() => document.body.classList.remove('dragging-tab')}
            onClick={() => useStore.getState().selectTab(i)}
            onAuxClick={(e) => e.button === 1 && useStore.getState().closeTab(i)}
          >
            <span className="tab-icon">{node?.icon ? <PageIcon icon={node.icon} size={13} /> : <Icon name="doc" size={13} />}</span>
            <span className="tab-title">{node?.title ?? '…'}</span>
            <button
              className="tab-close"
              aria-label={t('tabs.close')}
              onClick={(e) => {
                e.stopPropagation()
                useStore.getState().closeTab(i)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

/** Sekme sürüklenirken sayfanın sağ yarısında beliren bırakma alanı */
export function SplitDrop() {
  const t = useT()
  return (
    <div
      className="split-drop"
      data-testid="split-drop"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(TAB_MIME)) {
          e.preventDefault()
          e.currentTarget.classList.add('over')
        }
      }}
      onDragLeave={(e) => e.currentTarget.classList.remove('over')}
      onDrop={(e) => {
        e.currentTarget.classList.remove('over')
        document.body.classList.remove('dragging-tab')
        const id = e.dataTransfer.getData(TAB_MIME)
        if (id) useStore.getState().openSplit(id)
      }}
    >
      <span>{t('tabs.dropToSplit')}</span>
    </div>
  )
}
