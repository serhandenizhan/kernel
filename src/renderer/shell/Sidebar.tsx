import { useStore } from '../state/store'
import { PageTree } from './PageTree'
import { NewButton } from './NewMenu'
import { useT } from '../lib/i18n'
import { Icon } from '../assets/icons'
import logo from '../assets/logo.svg'
import { useState } from 'react'
import type { TreeNode } from '@shared/types'
import { PageIcon } from './PageHeader'
import { TagsSection } from './TagsSection'

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const c = findNode(n.children, id)
    if (c) return c
  }
  return null
}

/** Sabitlenenler bölümü: tıklayınca açar, sürükle-bırakla sıralanır */
function PinnedSection() {
  const t = useT()
  const pins = useStore((s) => s.pins)
  const tree = useStore((s) => s.tree)
  const currentId = useStore((s) => s.currentId)
  const [drag, setDrag] = useState<number | null>(null)
  const nodes = pins.map((id) => findNode(tree, id)).filter((n): n is TreeNode => n !== null)
  if (!nodes.length) return null
  const drop = (to: number) => {
    if (drag === null || drag === to) return
    const ids = nodes.map((n) => n.id)
    const [moved] = ids.splice(drag, 1)
    ids.splice(to, 0, moved!)
    void useStore.getState().setPins(ids)
    setDrag(null)
  }
  return (
    <div className="sidebar-pins">
      <div className="sidebar-section">
        <span>{t('sidebar.pinned')}</span>
      </div>
      {nodes.map((n, i) => (
        <button
          key={n.id}
          className={`nav-row pin-row${n.id === currentId ? ' active' : ''}`}
          data-testid="pin-row"
          draggable
          onDragStart={() => setDrag(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(i)}
          onClick={() => useStore.getState().openPage(n.id)}
        >
          <span className="pin-icon">{n.icon ? <PageIcon icon={n.icon} size={15} /> : <Icon name="doc" size={14} />}</span>
          <span className="nav-label">{n.title}</span>
        </button>
      ))}
    </div>
  )
}

// Kenar çubuğu (spec §18.1, mockup "Kenar çubuğu"): marka, arama, Yeni, Ana sayfa, sayfalar, Rehber/Ayarlar
export function Sidebar() {
  const t = useT()
  const s = useStore.getState
  const view = useStore((st) => st.view)

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-drag" />
      <div className="sidebar-brand" data-testid="sidebar-brand">
        <img src={logo} width={28} height={28} alt="" />
        <span>Kernel</span>
      </div>
      <div className="sidebar-actions">
        <button className="search-trigger" onClick={() => s().setOverlay('search')}>
          <Icon name="search" size={14} />
          <span>{t('sidebar.search')}</span>
          <kbd>⌘K</kbd>
        </button>
        <NewButton />
      </div>
      <nav className="sidebar-nav" aria-label={t('sidebar.home')}>
        <button className={`nav-row${view === 'home' ? ' active' : ''}`} data-testid="nav-home" onClick={() => s().openHome()}>
          <Icon name="home" />
          <span>{t('sidebar.home')}</span>
        </button>
      </nav>
      <PinnedSection />
      <div className="sidebar-section">
        <span>{t('sidebar.pages')}</span>
      </div>
      <PageTree
        onRequestIcon={(id) => {
          s().openPage(id)
          window.dispatchEvent(new CustomEvent('kernel:open-icon-picker'))
        }}
        onRequestExport={(id) => {
          s().openPage(id)
          s().setOverlay('export')
        }}
      />
      <TagsSection />
      <div className="sidebar-footer">
        <button className="footer-btn" onClick={() => s().setOverlay('guide')}>
          <Icon name="help" size={15} />
          <span>{t('sidebar.guide')}</span>
        </button>
        <button className="footer-btn" onClick={() => s().setOverlay('settings')}>
          <Icon name="settings" size={15} />
          <span>{t('sidebar.settings')}</span>
        </button>
      </div>
    </aside>
  )
}
