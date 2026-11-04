import MiniSearch from 'minisearch'
import type { JSONContent } from '@tiptap/core'
import type { SearchHit } from '@shared/types'
import { normalizeTr } from '@core/normalize-tr'
import { markdownToDoc } from '@core/markdown/parse'
import type { Vault } from './vault/vault'

interface Doc {
  id: string
  title: string
  path: string
  text: string
}

/** Markdown'ı aranabilir düz metne çevirir (formül LaTeX'i ve kod dahil) */
export function plainText(markdown: string): string {
  let doc: JSONContent
  try {
    doc = markdownToDoc(markdown)
  } catch {
    return ''
  }
  const parts: string[] = []
  const walk = (n: JSONContent) => {
    if (n.type === 'text' && n.text) parts.push(n.text)
    if ((n.type === 'blockMath' || n.type === 'inlineMath') && n.attrs?.['latex']) parts.push(String(n.attrs['latex']))
    if (n.type === 'image' && n.attrs?.['caption']) parts.push(String(n.attrs['caption']))
    n.content?.forEach(walk)
    if (n.type !== 'text' && n.type !== 'inlineMath') parts.push(' ')
  }
  walk(doc)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

const SNIPPET = 80

function snippetOf(text: string, terms: string[]): string {
  const norm = normalizeTr(text)
  let at = -1
  for (const t of terms) {
    const i = norm.indexOf(t)
    if (i !== -1 && (at === -1 || i < at)) at = i
  }
  if (at === -1) return text.slice(0, SNIPPET * 2)
  const start = Math.max(0, at - SNIPPET)
  return `${start > 0 ? '…' : ''}${text.slice(start, at + SNIPPET)}${at + SNIPPET < text.length ? '…' : ''}`
}

// Kasa için bellek içi tam metin arama (Türkçe normalizasyonlu)
export class SearchIndex {
  private mini = new MiniSearch<Doc>({
    fields: ['title', 'text'],
    storeFields: ['title', 'path', 'text'],
    processTerm: (term) => normalizeTr(term) || null,
    searchOptions: { boost: { title: 3 }, fuzzy: 0.2, prefix: true }
  })

  async build(vault: Vault): Promise<void> {
    this.mini.removeAll()
    const ids: string[] = []
    const collect = (nodes: Awaited<ReturnType<Vault['tree']>>) => {
      for (const n of nodes) {
        ids.push(n.id)
        collect(n.children)
      }
    }
    collect(await vault.tree())
    for (const id of ids) await this.update(vault, id)
  }

  async update(vault: Vault, id: string): Promise<void> {
    try {
      const page = await vault.read(id)
      const doc: Doc = { id, title: page.title, path: page.path, text: plainText(page.markdown) }
      if (this.mini.has(id)) this.mini.replace(doc)
      else this.mini.add(doc)
    } catch {
      this.remove(id)
    }
  }

  remove(id: string): void {
    if (this.mini.has(id)) this.mini.discard(id)
  }

  query(q: string, limit = 20): SearchHit[] {
    if (!q.trim()) return []
    const terms = q.split(/\s+/).map(normalizeTr).filter(Boolean)
    return this.mini
      .search(q)
      .slice(0, limit)
      .map((r) => ({ id: String(r.id), title: String(r['title']), path: String(r['path']), snippet: snippetOf(String(r['text'] ?? ''), terms), score: r.score }))
  }
}
