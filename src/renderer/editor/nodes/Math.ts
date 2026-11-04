import { Extension, InputRule } from '@tiptap/core'
import { Mathematics } from '@tiptap/extension-mathematics'
import { useMathEdit } from '../ui/math-state'

// Formül düğümleri (@tiptap/extension-mathematics) + Kernel davranışları:
// tıklayınca cam düzenleme alanı, "$$ " ile blok formül, Cmd+Shift+M ile satır içi formül
export const KernelMath = Mathematics.configure({
  katexOptions: { throwOnError: false, strict: 'ignore' },
  blockOptions: { onClick: (node, pos) => useMathEdit.getState().open('block', pos, String(node.attrs['latex'] ?? '')) },
  inlineOptions: { onClick: (node, pos) => useMathEdit.getState().open('inline', pos, String(node.attrs['latex'] ?? '')) }
})

export const MathShortcuts = Extension.create({
  name: 'kernelMathShortcuts',

  addInputRules() {
    return [
      // "$x^2$" → satır içi formül. Para birimi koruması: açılıştan sonra / kapanıştan önce boşluk yok,
      // açılış harf/rakam/$ veya \ ardından gelmez ("5$ ile 10$" metin kalır)
      new InputRule({
        find: /(?:^|[^\p{L}\p{N}$\\])\$([^\s$](?:[^$]*[^\s$\\])?)\$$/u,
        handler: ({ state, range, match }) => {
          const latex = match[1]
          const type = state.schema.nodes['inlineMath']
          if (!latex || !type) return null
          const start = range.to - (latex.length + 2)
          state.tr.replaceWith(start, range.to, type.create({ latex }))
        }
      }),
      // boş satırda "$$ " → boş blok formül ve düzenleme alanı
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range, chain }) => {
          const blockType = state.schema.nodes['blockMath']
          if (!blockType) return null
          const $from = state.doc.resolve(range.from)
          const start = $from.before()
          chain()
            .command(({ tr }) => {
              tr.replaceRangeWith(start, $from.after(), blockType.create({ latex: '' }))
              return true
            })
            .run()
          setTimeout(() => useMathEdit.getState().open('block', start, ''), 0)
        }
      })
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': ({ editor }) => {
        const { from, to, empty } = editor.state.selection
        const text = empty ? '' : editor.state.doc.textBetween(from, to)
        editor.chain().focus().deleteSelection().insertContent({ type: 'inlineMath', attrs: { latex: text } }).run()
        if (!text) setTimeout(() => useMathEdit.getState().open('inline', from, ''), 0)
        return true
      }
    }
  }
})
