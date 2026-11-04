import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import { kernel } from './lib/kernel'
import { Sidebar } from './shell/Sidebar'
import { VaultPicker } from './shell/VaultPicker'
import { Toasts } from './shell/Toasts'
import { PageView } from './shell/PageView'
import { SearchPalette } from './shell/SearchPalette'
import { SettingsDialog } from './shell/SettingsDialog'
import { TocPanel } from './shell/TocPanel'
import { ExportDialog } from './shell/ExportDialog'
import { GuidePage } from './guide/GuidePage'
import { HistoryPanel } from './shell/HistoryPanel'
import { ImportWizard } from './notion/ImportWizard'
import { Tour, TipBubble } from './guide/Tour'
import './guide/tips'
import { activeEditor } from './editor/Editor'

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
  const overlay = useStore((s) => s.overlay)
  const tourDone = useStore((s) => s.settings.tourDone)
  const [pendingImport, setPendingImport] = useState(false)
  const [resumeImport, setResumeImport] = useState(false)
  // sihirbaz kapanınca devam modu sıfırlanır (sonraki açılış baştan başlar)
  useEffect(() => {
    if (overlay !== 'notion') setResumeImport(false)
  }, [overlay])
  useTheme()
  useShortcuts()

  useEffect(() => {
    void useStore.getState().init()
    // uygulama kapanırken bekleyen kaydı yap
    kernel.app.onFlushRequest(async () => (activeEditor.flush ? activeEditor.flush() : true))
    const off = kernel.events.onTreeChanged(() => void useStore.getState().refreshTree())
    void kernel.notion.pendingResume().then(setPendingImport).catch(() => undefined)
    const offToast = kernel.events.onToast((m, kind) => useStore.getState().toast(m, kind))
    return () => {
      off()
      offToast()
    }
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
        <div className="page-surface">{overlay === 'guide' ? <GuidePage /> : <PageView />}</div>
        <TocPanel />
      </main>
      {overlay === 'search' && <SearchPalette />}
      {overlay === 'settings' && <SettingsDialog />}
      {overlay === 'export' && <ExportDialog />}
      {overlay === 'history' && <HistoryPanel />}
      {overlay === 'notion' && <ImportWizard resume={resumeImport} />}
      {pendingImport && overlay !== 'notion' && (
        <div className="resume-banner glass" data-testid="notion-resume-banner">
          Yarım kalan bir Notion aktarımı var.
          <button
            className="btn small primary"
            data-testid="notion-resume"
            onClick={() => {
              setPendingImport(false)
              setResumeImport(true)
              useStore.getState().setOverlay('notion')
            }}
          >
            Devam et
          </button>
        </div>
      )}
      {!tourDone && <Tour />}
      <TipBubble />
      <Toasts />
    </div>
  )
}
