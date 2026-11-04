import { useStore } from '../state/store'
import { PageTree } from './PageTree'
import { TemplateMenu } from './TemplateMenu'

export function Sidebar() {
  const vaultPath = useStore((s) => s.vaultPath)
  const vaultName = vaultPath?.split('/').filter(Boolean).pop() ?? 'Kasa'
  const s = useStore.getState

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-drag" />
      <button className="search-trigger" onClick={() => s().setOverlay('search')}>
        <span>⌕</span>
        <span>Ara</span>
        <kbd>⌘K</kbd>
      </button>
      <div className="sidebar-section">
        <span>{vaultName}</span>
        <span className="section-actions">
          <TemplateMenu />
          <button className="icon-btn" data-testid="new-page" title="Yeni sayfa (⌘N)" onClick={() => void s().createPage(null)}>
            +
          </button>
        </span>
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
      <div className="sidebar-footer">
        <button className="footer-btn" data-testid="notion-import" onClick={() => s().setOverlay('notion')}>
          <span>⇣</span> Notion'dan aktar
        </button>
        <button className="footer-btn" onClick={() => s().setOverlay('guide')}>
          <span>?</span> Rehber
        </button>
        <button className="footer-btn" onClick={() => s().setOverlay('settings')}>
          <span>⚙︎</span> Ayarlar
        </button>
      </div>
    </aside>
  )
}
