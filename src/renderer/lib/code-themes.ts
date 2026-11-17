import type { MessageKey } from '@shared/i18n'
import type { Settings } from '@shared/types'

// Kod bloğu temaları (VS Code gibi). Renklendirme Shiki'nin çok temalı çıktısıyla yapılır: her sözcük
// tüm temaların rengini CSS değişkeni olarak taşır (--shiki-<tema>), seçilen tema CSS ile uygulanır.
export type CodeThemeId = Settings['codeTheme']

export interface CodeTheme {
  id: CodeThemeId
  /** Ayarlar'da gösterilen ad (özel adlar çevrilmez) */
  label: MessageKey | string
  kind: 'auto' | 'light' | 'dark'
  /** önizlemede kullanılan Shiki tema adı (auto için uygulama temasına göre seçilir) */
  shiki: string | null
  /** önizleme kartının zemini (blokla aynı; auto için uygulama temasına göre seçilir) */
  bg: string | null
}

export const CODE_THEMES: CodeTheme[] = [
  { id: 'auto', label: 'codeTheme.auto', kind: 'auto', shiki: null, bg: null },
  { id: 'classic-light', label: 'codeTheme.classicLight', kind: 'light', shiki: 'github-light', bg: '#e6edf1' },
  { id: 'classic-dark', label: 'codeTheme.classicDark', kind: 'dark', shiki: 'github-dark', bg: '#151b21' },
  { id: 'claude-light', label: 'Claude Light', kind: 'light', shiki: 'claude-light', bg: '#faf9f5' },
  { id: 'claude-dark', label: 'Claude Dark', kind: 'dark', shiki: 'claude-dark', bg: '#262624' },
  { id: 'dracula', label: 'Dracula', kind: 'dark', shiki: 'dracula', bg: '#282a36' },
  { id: 'solarized-light', label: 'Solarized Light', kind: 'light', shiki: 'solarized-light', bg: '#fdf6e3' }
]

/** Seçilen temanın Shiki değişken adı (otomatik: uygulama temasını izler) */
export function codeThemeVar(id: CodeThemeId, app: 'light' | 'dark'): string {
  if (id === 'auto') return app === 'dark' ? 'github-dark' : 'github-light'
  if (id === 'classic-light') return 'github-light'
  if (id === 'classic-dark') return 'github-dark'
  return id
}

interface Rule {
  scope: string[]
  settings: { foreground?: string; fontStyle?: string }
}
export interface ClaudeTheme {
  name: string
  type: 'light' | 'dark'
  colors: Record<string, string>
  tokenColors: Rule[]
}

interface Palette {
  bg: string
  fg: string
  comment: string
  keyword: string
  string: string
  number: string
  constant: string
  fn: string
  type: string
  punct: string
}

function build(name: string, type: 'light' | 'dark', p: Palette): ClaudeTheme {
  const r = (scope: string[], foreground: string, fontStyle?: string): Rule => ({ scope, settings: fontStyle ? { foreground, fontStyle } : { foreground } })
  return {
    name,
    type,
    colors: { 'editor.background': p.bg, 'editor.foreground': p.fg },
    tokenColors: [
      r(['comment', 'punctuation.definition.comment'], p.comment, 'italic'),
      r(['string', 'string.quoted', 'punctuation.definition.string', 'string.template'], p.string),
      r(['constant.numeric'], p.number),
      r(['constant.language', 'constant.character', 'constant.other', 'support.constant', 'variable.language'], p.constant),
      r(['keyword', 'keyword.control', 'storage', 'storage.type', 'storage.modifier', 'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.logical.python'], p.keyword),
      r(['keyword.operator', 'punctuation', 'meta.brace', 'meta.delimiter', 'punctuation.separator', 'punctuation.accessor'], p.punct),
      r(['entity.name.function', 'support.function', 'meta.function-call', 'variable.function'], p.fn),
      r(['entity.name.type', 'entity.name.class', 'support.class', 'support.type', 'entity.other.inherited-class', 'meta.decorator', 'entity.name.function.decorator'], p.type),
      r(['entity.name.tag'], p.keyword),
      r(['entity.other.attribute-name', 'support.type.property-name', 'meta.object-literal.key'], p.fn),
      r(['markup.heading', 'entity.name.section'], p.keyword, 'bold'),
      r(['markup.bold'], p.fg, 'bold'),
      r(['markup.italic'], p.fg, 'italic'),
      r(['variable', 'variable.parameter', 'meta.definition.variable'], p.fg)
    ]
  }
}

// Claude renkleri: sıcak krem / koyu kömür zemin, kil (terracotta) anahtar sözcükler, zeytin yeşili metinler.
// Tüm renkler zeminde WCAG AA (4.5) kontrastı sağlar (test/unit/renderer/code-themes.test.ts).
export const CLAUDE_LIGHT = build('claude-light', 'light', {
  bg: '#FAF9F5',
  fg: '#3D3929',
  comment: '#6F6A5B',
  keyword: '#B4492A',
  string: '#4F7A28',
  number: '#8F5F00',
  constant: '#9A4A1A',
  fn: '#2F6B8F',
  type: '#7A4EA3',
  punct: '#6B6659'
})

export const CLAUDE_DARK = build('claude-dark', 'dark', {
  bg: '#262624',
  fg: '#E8E6DC',
  comment: '#9A978A',
  keyword: '#E58A68',
  string: '#A9C98A',
  number: '#E6B65C',
  constant: '#F0A07A',
  fn: '#8DB8DB',
  type: '#C9A9E8',
  punct: '#B5B2A6'
})
