import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { normalizeTr } from '@core/normalize-tr'
import { SLASH_ITEMS, type SlashItem } from '../slash-items'
import { useSlash } from '../ui/slash-state'

export function filterSlashItems(query: string): SlashItem[] {
  const q = normalizeTr(query.trim())
  if (!q) return SLASH_ITEMS
  return SLASH_ITEMS.filter((it) => normalizeTr(it.label).includes(q) || it.keywords.some((k) => normalizeTr(k).startsWith(q)))
}

// "/" yazınca blok menüsü
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        pluginKey: new PluginKey('slashCommand'),
        allowSpaces: false,
        startOfLine: false,
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run()
          props.run(editor)
        },
        render: () => ({
          onStart: (p) => useSlash.getState().show(p.items, p.command, p.clientRect?.() ?? null),
          onUpdate: (p) => useSlash.getState().show(p.items, p.command, p.clientRect?.() ?? null),
          onKeyDown: ({ event }) => useSlash.getState().key(event),
          onExit: () => useSlash.getState().hide()
        })
      })
    ]
  }
})
