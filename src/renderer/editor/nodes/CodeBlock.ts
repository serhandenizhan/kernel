import CodeBlock from '@tiptap/extension-code-block'
import { textblockTypeInputRule } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { Plugin } from '@tiptap/pm/state'
import { createHighlightPlugin, type Parser } from 'prosemirror-highlight'
import { createParser } from 'prosemirror-highlight/shiki'
import { normalizeLanguage } from '@core/smart-paste/language'
import { getHighlighter, getLoadedHighlighter, HIGHLIGHT_LANGUAGES, THEMES } from '../../lib/shiki'
import { CodeBlockView } from '../ui/CodeBlockView'

let shikiParser: Parser | null = null

// Shiki hazır değilse yüklenmesini bekletir; desteklenmeyen dilde renklendirme yapmaz
const parser: Parser = (opts) => {
  const lang = opts.language ?? ''
  if (!HIGHLIGHT_LANGUAGES.includes(lang)) return []
  const hl = getLoadedHighlighter()
  if (!hl) return getHighlighter().then(() => undefined)
  shikiParser ??= createParser(hl, { themes: THEMES, defaultColor: false })
  return shikiParser(opts)
}

export const KernelCodeBlock = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      lineNumbers: { default: false, renderHTML: (a: { lineNumbers?: boolean }) => (a.lineNumbers ? { 'data-line-numbers': '' } : {}) }
    }
  },

  // ```py → Python (dil adı normalize edilir)
  addInputRules() {
    return [
      textblockTypeInputRule({
        find: /^```([a-zA-Z0-9+#-]*)[\s\n]$/,
        type: this.type,
        getAttributes: (match) => ({ language: normalizeLanguage(match[1] ?? null) })
      })
    ]
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      Tab: () => (this.editor.isActive(this.name) ? this.editor.commands.insertContent('  ') : false),
      'Mod-Alt-c': () => this.editor.commands.toggleCodeBlock()
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },

  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), createHighlightPlugin({ parser, nodeTypes: [this.name] }) as Plugin]
  }
})
