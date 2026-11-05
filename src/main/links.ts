import type { Backlink, GraphData, TagCount, TreeNode } from '@shared/types'
import { extractLinks, extractTags, renameLinks, type LinkRef } from '@core/links'
import { resolveWikiTarget } from '@core/wiki'
import { foldKey } from '@core/fold'
import type { Vault } from './vault/vault'
import { log } from './log'

interface Entry {
  title: string
  path: string
  links: LinkRef[]
  tags: string[]
}

function flatten(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    out.push(n)
    flatten(n.children, out)
  }
  return out
}

// Kasadaki [[link]] ve #etiketlerin bellek içi dizini: geri bağlantılar, graf ve etiket paneli buradan beslenir
export class LinkIndex {
  private pages = new Map<string, Entry>()
  private tree: TreeNode[] = []

  async build(vault: Vault): Promise<void> {
    this.tree = await vault.tree()
    this.pages.clear()
    for (const n of flatten(this.tree)) await this.load(vault, n.id)
  }

  async update(vault: Vault, id: string): Promise<void> {
    this.tree = await vault.tree()
    await this.load(vault, id)
  }

  remove(id: string): void {
    this.pages.delete(id)
  }

  private async load(vault: Vault, id: string): Promise<void> {
    try {
      const p = await vault.read(id)
      this.pages.set(id, { title: p.title, path: p.path, links: extractLinks(p.markdown), tags: extractTags(p.markdown, p.meta.tags) })
    } catch (e) {
      this.pages.delete(id)
      log.warn('Link dizinine eklenemedi', e instanceof Error ? e.message : 'bilinmeyen')
    }
  }

  private resolve(target: string): string | null {
    return resolveWikiTarget(this.tree, target)
  }

  backlinks(id: string): Backlink[] {
    const out: Backlink[] = []
    for (const [src, e] of this.pages) {
      if (src === id) continue
      const hit = e.links.find((l) => this.resolve(l.target) === id)
      if (hit) out.push({ id: src, title: e.title, context: hit.line })
    }
    return out.sort((a, b) => a.title.localeCompare(b.title))
  }

  graph(): GraphData {
    const nodes = [...this.pages].map(([id, e]) => ({ id, title: e.title, folder: e.path.includes('/') ? e.path.split('/')[0]! : '', tags: e.tags }))
    const seen = new Set<string>()
    const links: GraphData['links'] = []
    for (const [src, e] of this.pages) {
      for (const l of e.links) {
        const t = this.resolve(l.target)
        const k = `${src}>${t}`
        if (!t || t === src || !this.pages.has(t) || seen.has(k)) continue
        seen.add(k)
        links.push({ source: src, target: t })
      }
    }
    return { nodes, links }
  }

  tags(): TagCount[] {
    const counts = new Map<string, TagCount>()
    for (const e of this.pages.values()) {
      for (const tag of e.tags) {
        const k = foldKey(tag)
        const c = counts.get(k)
        if (c) c.count++
        else counts.set(k, { tag, count: 1 })
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  }

  pagesWithTag(tag: string): { id: string; title: string }[] {
    const k = foldKey(tag.replace(/^#/, ''))
    return [...this.pages]
      .filter(([, e]) => e.tags.some((t) => foldKey(t) === k))
      .map(([id, e]) => ({ id, title: e.title }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }
}

const noExt = (p: string) => p.replace(/\.md$/i, '')

/**
 * Sayfa yeniden adlandırılınca / taşınınca, eskiden o sayfaya çözümlenen linkleri kasa genelinde günceller.
 * Yeni başlık başka bir sayfayla çakışıyorsa link yol biçiminde yazılır. Değişen sayfa kimliklerini döndürür.
 */
export async function rewriteLinksAfterRelocate(vault: Vault, id: string, oldTree: TreeNode[]): Promise<string[]> {
  const old = flatten(oldTree).find((n) => n.id === id)
  if (!old) return []
  const tree = await vault.tree()
  const all = flatten(tree)
  const now = all.find((n) => n.id === id)
  if (!now) return []
  const olds = [old.title, noExt(old.path)].filter((t) => resolveWikiTarget(oldTree, t) === id)
  if (olds.length === 0) return []
  const ambiguous = all.some((n) => n.id !== id && foldKey(n.title) === foldKey(now.title))
  const next = ambiguous ? noExt(now.path) : now.title
  const changed: string[] = []
  for (const n of all) {
    try {
      const p = await vault.read(n.id)
      if (p.readOnly) continue
      const md = renameLinks(p.markdown, olds, next)
      if (md === p.markdown) continue
      await vault.write(n.id, { markdown: md, meta: p.meta })
      changed.push(n.id)
    } catch (e) {
      log.warn('Link güncellenemedi', e instanceof Error ? e.message : 'bilinmeyen')
    }
  }
  return changed
}
