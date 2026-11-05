import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { filterPages, linkTargetFor } from '@core/wiki'
import { normalizeTr } from '@core/normalize-tr'
import { useStore } from '../../state/store'
import { useWikiMenu, type WikiItem } from '../ui/wiki-state'

/** Seçicide gösterilecek maddeler: eşleşen sayfalar + (tam eşleşme yoksa) "oluştur" maddesi */
export function wikiItems(query: string): WikiItem[] {
  const tree = useStore.getState().tree
  const q = query.trim()
  const pages: WikiItem[] = filterPages(tree, q).map((n) => ({ kind: 'page', id: n.id, title: n.title, path: n.path, target: linkTargetFor(tree, n.id), ...(n.icon ? { icon: n.icon } : {}) }))
  const exact = pages.some((p) => p.kind === 'page' && normalizeTr(p.title) === normalizeTr(q))
  return q && !exact ? [...pages, { kind: 'create', title: q, target: q }] : pages
}

// "[[" yazınca sayfa seçici (spec §12); seçilen sayfa [[Başlık]] olarak eklenir
export const WikiPicker = Extension.create({
  name: 'wikiPicker',
  addProseMirrorPlugins() {
    return [
      Suggestion<WikiItem>({
        editor: this.editor,
        char: '[[',
        pluginKey: new PluginKey('wikiPicker'),
        allowSpaces: true,
        startOfLine: false,
        items: ({ query }) => wikiItems(query),
        command: ({ editor, range, props }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([{ type: 'wikiLink', attrs: { target: props.target, label: null } }, { type: 'text', text: ' ' }])
            .run()
        },
        render: () => ({
          onStart: (p) => useWikiMenu.getState().show(p.items, p.command, p.clientRect?.() ?? null),
          onUpdate: (p) => useWikiMenu.getState().show(p.items, p.command, p.clientRect?.() ?? null),
          onKeyDown: ({ event }) => useWikiMenu.getState().key(event),
          onExit: () => useWikiMenu.getState().hide()
        })
      })
    ]
  }
})
