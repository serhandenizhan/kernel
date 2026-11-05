import type { MessageKey } from '@shared/i18n'

export interface Shortcut {
  /** sözlük anahtarı */
  group: MessageKey
  /** tuşlar; sözlük anahtarıysa (sc.*) çevrilir */
  keys: string
  /** sözlük anahtarı */
  action: MessageKey
  phase: 1 | 2 | 3
}

// Kısayol tablosu (spec §13). Faz 1 dışındakiler rehberde gösterilmez.
export const SHORTCUTS: Shortcut[] = [
  { group: 'sc.group.pages', keys: '⌘N', action: 'sc.newPage', phase: 1 },
  { group: 'sc.group.pages', keys: '⌘⇧N', action: 'sc.newChild', phase: 1 },
  { group: 'sc.group.pages', keys: '⌘K', action: 'sc.search', phase: 1 },
  { group: 'sc.group.pages', keys: '⌘E', action: 'sc.exportPdf', phase: 1 },
  { group: 'sc.group.view', keys: '⌘\\', action: 'sc.sidebar', phase: 1 },
  { group: 'sc.group.view', keys: '⌘⇧T', action: 'sc.toc', phase: 1 },
  { group: 'sc.group.view', keys: '⌘/', action: 'sc.guide', phase: 1 },
  { group: 'sc.group.view', keys: '⌘,', action: 'sc.settings', phase: 1 },
  { group: 'sc.group.writing', keys: '⌘B', action: 'sc.bold', phase: 1 },
  { group: 'sc.group.writing', keys: '⌘I', action: 'sc.italic', phase: 1 },
  { group: 'sc.group.writing', keys: '⌘U', action: 'sc.underline', phase: 1 },
  { group: 'sc.group.writing', keys: '⌘⇧S', action: 'sc.strike', phase: 1 },
  { group: 'sc.group.writing', keys: '⌘⇧M', action: 'sc.inlineMath', phase: 1 },
  { group: 'sc.group.writing', keys: '⌘⌥C', action: 'sc.codeBlock', phase: 1 },
  { group: 'sc.group.writing', keys: '/', action: 'sc.slash', phase: 1 },
  { group: 'sc.group.writing', keys: 'sc.mathKeys', action: 'sc.blockMath', phase: 1 },
  { group: 'sc.group.paste', keys: '⌘V', action: 'sc.smartPaste', phase: 1 },
  { group: 'sc.group.paste', keys: '⌘Z', action: 'sc.undoPaste', phase: 1 },
  { group: 'sc.group.paste', keys: '⌘⇧V', action: 'sc.rawPaste', phase: 1 },
  { group: 'sc.group.navigation', keys: '⌘P', action: 'sc.palette', phase: 3 },
  { group: 'sc.group.navigation', keys: '⌘⇧F', action: 'sc.focus', phase: 3 },
  { group: 'sc.group.navigation', keys: '⌘T', action: 'sc.newTab', phase: 3 },
  { group: 'sc.group.navigation', keys: '⌘W', action: 'sc.closeTab', phase: 3 }
]
