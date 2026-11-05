import type { MessageKey } from '@shared/i18n'
import { normalizeTr } from '@core/normalize-tr'
import { tNow } from './lib/i18n'
import { useStore } from './state/store'
import { createLectureNote } from './shell/NewMenu'

export interface Command {
  id: string
  label: MessageKey
  /** gösterilen kısayol (macOS sembolleriyle) */
  keys?: string
  /** komut şu an kullanılabilir mi (örn. açık sayfa gerektirenler) */
  enabled?: () => boolean
  run: () => void
}

const hasPage = () => useStore.getState().view === 'page' && !!useStore.getState().currentId
const s = () => useStore.getState()

// Komut paletindeki komutlar (spec §12); kısayollar App.tsx'teki tuş işleyicisiyle aynıdır
export const COMMANDS: Command[] = [
  { id: 'new-page', label: 'sc.newPage', keys: '⌘N', run: () => void s().createPage(null) },
  { id: 'new-child', label: 'sc.newChild', keys: '⌘⇧N', enabled: hasPage, run: () => void s().createPage(s().currentId) },
  { id: 'lecture', label: 'sidebar.lecture', run: () => void createLectureNote() },
  { id: 'search', label: 'sc.search', keys: '⌘K', run: () => s().setOverlay('search') },
  { id: 'home', label: 'sidebar.home', run: () => s().openHome() },
  { id: 'study', label: 'cmd.study', run: () => s().openStudy() },
  { id: 'graph', label: 'cmd.graph', run: () => s().openGraph(null) },
  { id: 'local-graph', label: 'cmd.localGraph', enabled: hasPage, run: () => s().openGraph(s().currentId) },
  { id: 'export', label: 'cmd.export', keys: '⌘E', enabled: hasPage, run: () => s().setOverlay('export') },
  { id: 'focus', label: 'sc.focus', keys: '⌘⇧F', run: () => s().toggleFocus() },
  { id: 'sidebar', label: 'sc.sidebar', keys: '⌘\\', run: () => s().toggleSidebar() },
  { id: 'toc', label: 'sc.toc', keys: '⌘⇧T', run: () => s().toggleToc() },
  {
    id: 'theme',
    label: 'cmd.theme',
    run: () => {
      const dark = document.documentElement.dataset['theme'] === 'dark'
      void s().setSettings({ theme: dark ? 'light' : 'dark' })
    }
  },
  { id: 'history', label: 'cmd.history', enabled: hasPage, run: () => s().setOverlay('history') },
  { id: 'notion', label: 'cmd.notion', run: () => s().setOverlay('notion') },
  { id: 'guide', label: 'sc.guide', keys: '⌘/', run: () => s().setOverlay('guide') },
  { id: 'settings', label: 'sc.settings', keys: '⌘,', run: () => s().setOverlay('settings') }
]

/** Paletteki arama: Türkçe harfler katlanır, kelime başı eşleşmeler önce */
export function filterCommands(cmds: Command[], query: string): Command[] {
  const q = normalizeTr(query.trim())
  const usable = cmds.filter((c) => !c.enabled || c.enabled())
  if (!q) return usable
  const scored = usable
    .map((c) => {
      const label = normalizeTr(tNow(c.label))
      const score = label.startsWith(q) ? 0 : label.split(/[\s/(]+/).some((w) => w.startsWith(q)) ? 1 : label.includes(q) ? 2 : -1
      return { c, score }
    })
    .filter((x) => x.score >= 0)
  return scored.sort((a, b) => a.score - b.score).map((x) => x.c)
}
