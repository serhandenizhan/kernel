import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import { findInText } from '@core/find'

// Sayfa içi arama (⌘F): eşleşmeleri vurgular; dosyaya hiçbir şey yazılmaz
export interface FindState {
  query: string
  current: number
  matches: [number, number][]
  decos: DecorationSet
}

export const findKey = new PluginKey<FindState>('find')

/** Belgede tüm eşleşmelerin [from, to) konumları (satır içi atom düğümler tek karakter sayılır) */
export function findInDoc(doc: PMNode, query: string): [number, number][] {
  if (!query.trim()) return []
  const out: [number, number][] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    let text = ''
    node.forEach((child) => {
      text += child.isText ? child.text! : '￼'.repeat(child.nodeSize)
    })
    for (const [a, b] of findInText(text, query)) out.push([pos + 1 + a, pos + 1 + b])
    return false
  })
  return out
}

function build(doc: PMNode, query: string, current: number): FindState {
  const matches = findInDoc(doc, query)
  const cur = matches.length ? Math.min(Math.max(current, 0), matches.length - 1) : 0
  const decos = DecorationSet.create(
    doc,
    matches.map(([a, b], i) => Decoration.inline(a, b, { class: i === cur ? 'find-match find-current' : 'find-match' }))
  )
  return { query, current: cur, matches, decos }
}

export function findState(state: EditorState): FindState | undefined {
  return findKey.getState(state)
}

export const FindHighlight = Extension.create({
  name: 'findHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: (_c, state) => build(state.doc, '', 0),
          apply: (tr, old) => {
            const meta = tr.getMeta(findKey) as { query: string; current: number } | undefined
            if (meta) return build(tr.doc, meta.query, meta.current)
            return tr.docChanged && old.query ? build(tr.doc, old.query, old.current) : old
          }
        },
        props: { decorations: (state) => findKey.getState(state)?.decos }
      })
    ]
  }
})
