import { useStore } from '../state/store'
import { tNow } from '../lib/i18n'
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
        <span>{tNow('sidebar.search')}</span>
        <kbd>⌘K</kbd>
      </button>
      <div className="sidebar-section">
        <span>{vaultName}</span>
        <span className="section-actions">
          <TemplateMenu />
          <button className="icon-btn" data-testid="new-page" title={tNow('sidebar.newPage')} onClick={() => void s().createPage(null)}>
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
          <span>⇣</span> {tNow('sidebar.notionImport')}
        </button>
        <button className="footer-btn" onClick={() => s().setOverlay('guide')}>
          <span>?</span> {tNow('sidebar.guide')}
        </button>
        <button className="footer-btn" onClick={() => s().setOverlay('settings')}>
          <span>⚙︎</span> {tNow('sidebar.settings')}
        </button>
      </div>
    </aside>
  )
}
