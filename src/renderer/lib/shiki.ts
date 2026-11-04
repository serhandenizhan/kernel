import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

// Shiki: WASM yerine JS regex motoru (CSP'de wasm-unsafe-eval gerekmez)
// Kernel dil adı → shiki gramer modülü
const LANG_LOADERS: Record<string, () => Promise<unknown>> = {
  python: () => import('shiki/langs/python.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  matlab: () => import('shiki/langs/matlab.mjs'),
  r: () => import('shiki/langs/r.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  php: () => import('shiki/langs/php.mjs')
}

export const HIGHLIGHT_LANGUAGES = Object.keys(LANG_LOADERS)
export const THEMES = { light: 'github-light-default', dark: 'github-dark-default' } as const

let highlighter: HighlighterCore | null = null
let loading: Promise<HighlighterCore> | null = null

export function getLoadedHighlighter(): HighlighterCore | null {
  return highlighter
}

export function getHighlighter(): Promise<HighlighterCore> {
  if (highlighter) return Promise.resolve(highlighter)
  loading ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    themes: [import('shiki/themes/github-light-default.mjs'), import('shiki/themes/github-dark-default.mjs')],
    langs: Object.values(LANG_LOADERS).map((load) => load() as never)
  }).then((h) => (highlighter = h))
  return loading
}
