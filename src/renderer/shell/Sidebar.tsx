import { useStore } from '../state/store'
import { PageTree } from './PageTree'
import { NewButton } from './NewMenu'
import { useT } from '../lib/i18n'
import { Icon } from '../assets/icons'
import logo from '../assets/logo.svg'

// Kenar çubuğu (spec §18.1, mockup "Kenar çubuğu"): marka, arama, Yeni, Ana sayfa, sayfalar, Rehber/Ayarlar
export function Sidebar() {
  const t = useT()
  const s = useStore.getState

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
        <button className="nav-row" data-testid="nav-home" onClick={() => s().openHome()}>
          <Icon name="home" />
          <span>{t('sidebar.home')}</span>
        </button>
      </nav>
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
