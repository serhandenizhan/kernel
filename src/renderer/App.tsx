import { useEffect, useState } from 'react'
import { useStore } from './state/store'
import { kernel } from './lib/kernel'
import { Sidebar } from './shell/Sidebar'
import { VaultPicker } from './shell/VaultPicker'
import { Toasts } from './shell/Toasts'
import { PageView } from './shell/PageView'
import { SearchPalette } from './shell/SearchPalette'
import { CommandPalette } from './shell/CommandPalette'
import { SettingsDialog } from './shell/SettingsDialog'
import { TocPanel } from './shell/TocPanel'
import { ExportDialog } from './shell/ExportDialog'
import { GuidePage } from './guide/GuidePage'
import { HistoryPanel } from './shell/HistoryPanel'
import { ImportWizard } from './notion/ImportWizard'
import { Tour, TipBubble } from './guide/Tour'
import './guide/tips'
import { activeEditor } from './editor/Editor'
import { tNow, useLang } from './lib/i18n'
import { HomePage } from './home/HomePage'
import { TagPage } from './shell/TagPage'
import { GraphView } from './graph/GraphView'
import { ErrorBoundary } from './shell/ErrorBoundary'

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
      } else if (k === 'p' && !e.shiftKey) {
        e.preventDefault()
        s.setOverlay(s.overlay === 'palette' ? null : 'palette')
      } else if (k === 'f' && e.shiftKey) {
        e.preventDefault()
        s.toggleFocus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function App() {
  // dil değişince bütün arayüz yeniden çizilir (yeniden başlatma gerekmez)
  const lang = useLang()
  const ready = useStore((s) => s.ready)
  const vaultPath = useStore((s) => s.vaultPath)
  const sidebarVisible = useStore((s) => s.sidebarVisible)
  const focusMode = useStore((s) => s.focusMode)
  const overlay = useStore((s) => s.overlay)
  const view = useStore((s) => s.view)
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
    const offMenu = kernel.events.onMenuCommand((cmd) => {
      const s = useStore.getState()
      if (cmd === 'settings') s.setOverlay('settings')
      else if (cmd === 'toggle-sidebar') s.toggleSidebar()
      else if (cmd === 'toggle-focus') s.toggleFocus()
      else if (cmd === 'palette') s.setOverlay('palette')
      else s.toggleToc()
    })
    return () => {
      off()
      offToast()
      offMenu()
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
    <div className={`app${sidebarVisible && !focusMode ? '' : ' sidebar-hidden'}${focusMode ? ' focus-mode' : ''}`} lang={lang}>
      {sidebarVisible && !focusMode && <Sidebar />}
      <main className="main">
        <div className="main-drag" />
        <div className="page-surface">
          {/* hata olursa sayfa görünümüne düşer; görünüm değişince yeniden dener */}
          <ErrorBoundary resetKey={`${view}:${overlay}`} fallback={<PageView />}>
            {overlay === 'guide' ? <GuidePage /> : view === 'home' ? <HomePage /> : view === 'tag' ? <TagPage /> : view === 'graph' ? <GraphView /> : <PageView />}
          </ErrorBoundary>
        </div>
        {!focusMode && <TocPanel />}
      </main>
      {overlay === 'search' && <SearchPalette />}
      {overlay === 'palette' && <CommandPalette />}
      {overlay === 'settings' && <SettingsDialog />}
      {overlay === 'export' && <ExportDialog />}
      {overlay === 'history' && <HistoryPanel />}
      {overlay === 'notion' && <ImportWizard resume={resumeImport} />}
      {pendingImport && overlay !== 'notion' && (
        <div className="resume-banner glass" data-testid="notion-resume-banner">
          {tNow('notion.resumeBanner')}
          <button
            className="btn small primary"
            data-testid="notion-resume"
            onClick={() => {
              setPendingImport(false)
              setResumeImport(true)
              useStore.getState().setOverlay('notion')
            }}
          >
            {tNow('notion.resume')}
          </button>
        </div>
      )}
      {!tourDone && <Tour />}
      <TipBubble />
      <Toasts />
    </div>
  )
}
