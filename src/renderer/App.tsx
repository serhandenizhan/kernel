import { useEffect } from 'react'
import { useStore } from './state/store'
import { kernel } from './lib/kernel'
import { Sidebar } from './shell/Sidebar'
import { VaultPicker } from './shell/VaultPicker'
import { Toasts } from './shell/Toasts'
import { PageView } from './shell/PageView'
import './styles/tokens.css'
import './styles/glass.css'
import './styles/app.css'

function useTheme() {
  const settings = useStore((s) => s.settings)
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      root.dataset['theme'] = dark ? 'dark' : 'light'
    }
    apply()
    root.dataset['bodyFont'] = settings.bodyFont
    root.dataset['pageWidth'] = settings.pageWidth
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [settings.theme, settings.bodyFont, settings.pageWidth])
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey) return
      const s = useStore.getState()
      const k = e.key.toLowerCase()
      if (k === '\\') {
        e.preventDefault()
        s.toggleSidebar()
      } else if (k === 'n' && !e.shiftKey) {
        e.preventDefault()
        void s.createPage(null)
      } else if (k === 'n' && e.shiftKey) {
        e.preventDefault()
        void s.createPage(s.currentId)
      } else if (k === 'k') {
        e.preventDefault()
        s.setOverlay(s.overlay === 'search' ? null : 'search')
      } else if (k === ',') {
        e.preventDefault()
        s.setOverlay('settings')
      } else if (k === '/') {
        e.preventDefault()
        s.setOverlay(s.overlay === 'guide' ? null : 'guide')
      } else if (k === 'e' && !e.shiftKey) {
        e.preventDefault()
        if (s.currentId) s.setOverlay('export')
      } else if (k === 't' && e.shiftKey) {
        e.preventDefault()
        s.toggleToc()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function App() {
  const ready = useStore((s) => s.ready)
  const vaultPath = useStore((s) => s.vaultPath)
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  useTheme()
  useShortcuts()

  useEffect(() => {
    void useStore.getState().init()
    const off = kernel.events.onTreeChanged(() => void useStore.getState().refreshTree())
    return off
  }, [])

  if (!ready) return null
  if (!vaultPath) {
    return (
      <div className="app">
        <VaultPicker />
        <Toasts />
      </div>
    )
  }
  return (
    <div className={`app${sidebarVisible ? '' : ' sidebar-hidden'}`}>
      {sidebarVisible && <Sidebar />}
      <main className="main">
        <div className="main-drag" />
        <div className="page-surface">
          <PageView />
        </div>
      </main>
      <Toasts />
    </div>
  )
}
