import type { Backlink, Deck, GraphData, TagCount, TreeNode } from '@shared/types'
import { extractCards, type Card } from '@core/cards'
import { extractLinks, extractTags, renameLinks, type LinkRef } from '@core/links'
import { resolveWikiTarget } from '@core/wiki'
import { foldKey } from '@core/fold'
import type { Vault } from './vault/vault'
import { log } from './log'
import { readFile } from 'node:fs/promises'

interface Entry {
  title: string
  path: string
  links: LinkRef[]
  tags: string[]
  cards: Card[]
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
    // yeni dizin ayrı kurulur, bitince eskisiyle değiştirilir: tarama sürerken geri bağlantı / graf boş görünmez
    const tree = await vault.tree()
    const pages = new Map<string, Entry>()
    for (const n of flatten(tree)) {
      const e = await this.read(vault, n.id)
      if (e) pages.set(n.id, e)
    }
    this.tree = tree
    this.pages = pages
  }

  async update(vault: Vault, id: string): Promise<void> {
    this.tree = await vault.tree()
    await this.load(vault, id)
  }

  remove(id: string): void {
    this.pages.delete(id)
  }

  private async read(vault: Vault, id: string): Promise<Entry | null> {
    try {
      const p = await vault.read(id)
      return { title: p.title, path: p.path, links: extractLinks(p.markdown), tags: extractTags(p.markdown, p.meta.tags), cards: extractCards(id, p.markdown) }
    } catch (e) {
      log.warn('Link dizinine eklenemedi', e instanceof Error ? e.message : 'bilinmeyen')
      return null
    }
  }

  private async load(vault: Vault, id: string): Promise<void> {
    const e = await this.read(vault, id)
    if (e) this.pages.set(id, e)
    else this.pages.delete(id)
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

  allCards(): Card[] {
    return [...this.pages.values()].flatMap((e) => e.cards)
  }

  /** Deste kartları: tüm kasa, tek sayfa, klasör (sayfa + alt sayfaları) ya da etiket */
  cardsIn(deck: Deck): Card[] {
    if (deck.kind === 'all') return this.allCards()
    if (deck.kind === 'page') return this.pages.get(deck.id)?.cards ?? []
    if (deck.kind === 'tag') return this.pagesWithTag(deck.tag).flatMap((p) => this.pages.get(p.id)?.cards ?? [])
    const root = flatten(this.tree).find((n) => n.id === deck.id)
    return root ? flatten([root]).flatMap((n) => this.pages.get(n.id)?.cards ?? []) : []
  }

  /** Kartı olan sayfalar (ağaç sırasıyla) ve alt sayfalarında kart olan üst sayfalar */
  cardPages(): { id: string; title: string; own: number; withChildren: number }[] {
    const out: { id: string; title: string; own: number; withChildren: number }[] = []
    for (const n of flatten(this.tree)) {
      const own = this.pages.get(n.id)?.cards.length ?? 0
      const withChildren = this.cardsIn({ kind: 'folder', id: n.id }).length
      if (withChildren > 0) out.push({ id: n.id, title: n.title, own, withChildren })
    }
    return out
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
 * Sayfa yeniden adlandırılınca / taşınınca, eskiden o sayfaya ya da alt sayfalarına çözümlenen linkleri kasa genelinde günceller.
 * Yeni başlık başka bir sayfayla çakışıyorsa link yol biçiminde yazılır. `snapshot` yazmadan önceki hali geçmişe alır.
 * Değişen sayfa kimliklerini döndürür.
 */
export async function rewriteLinksAfterRelocate(vault: Vault, id: string, oldTree: TreeNode[], snapshot?: (pageId: string, text: string) => Promise<void>): Promise<string[]> {
  const old = flatten(oldTree).find((n) => n.id === id)
  if (!old) return []
  const all = flatten(await vault.tree())
  // taşınan sayfa ve alt sayfalarının her biri için: eski hedefler → yeni hedef
  const rules: { olds: string[]; next: string }[] = []
  for (const o of flatten([old])) {
    const now = all.find((n) => n.id === o.id)
    if (!now) continue
    const olds = [o.title, noExt(o.path)].filter((t) => resolveWikiTarget(oldTree, t) === o.id)
    const ambiguous = all.some((n) => n.id !== o.id && foldKey(n.title) === foldKey(now.title))
    const next = ambiguous ? noExt(now.path) : now.title
    if (olds.length && !olds.every((t) => t === next)) rules.push({ olds, next })
  }
  // ad çakışması: eskiden başka bir sayfayı gösteren [[Ad]] linkleri, artık aynı adı taşıyan iki sayfa olduğundan
  // o sayfanın yoluna sabitlenir; görünen metin aynı kalır ([[Ders1/Notlar|Notlar]])
  const moved = new Set(flatten([old]).map((o) => o.id))
  const clashed = new Set(flatten([old]).map((o) => all.find((n) => n.id === o.id)).filter((n): n is TreeNode => !!n).map((n) => foldKey(n.title)))
  const pinCache = new Map<string, string | null>()
  const pinFor = (target: string): string | null => {
    const key = foldKey(target.trim())
    if (pinCache.has(key)) return pinCache.get(key)!
    let pin: string | null = null
    if (clashed.has(key)) {
      // link ad biçiminde yazılmış ve eskiden taşınmayan bir sayfayı gösteriyordu; şimdi bu adı taşıyan birden çok sayfa var
      const was = resolveWikiTarget(oldTree, target)
      const still = was && !moved.has(was) ? all.find((n) => n.id === was) : undefined
      const byPath = still && foldKey(noExt(still.path)) === key
      const ambiguous = all.filter((n) => foldKey(n.title) === key).length > 1
      if (still && !byPath && ambiguous) pin = noExt(still.path)
    }
    pinCache.set(key, pin)
    return pin
  }
  const changed: string[] = []
  for (const n of all) {
    try {
      const p = await vault.read(n.id)
      if (p.readOnly) continue
      // önce yazıldığı haliyle sabitlenir (eski ağaçta ne gösteriyordu), sonra taşınan sayfanın linkleri yenilenir
      let md = p.markdown
      for (const l of extractLinks(md)) {
        const pin = pinFor(l.target)
        if (pin) md = renameLinks(md, [l.target], pin, { keepText: true })
      }
      md = rules.reduce((body, r) => renameLinks(body, r.olds, r.next), md)
      if (md === p.markdown) continue
      if (snapshot) await snapshot(n.id, await readFile(vault.pathOf(n.id), 'utf8')).catch(() => undefined)
      await vault.write(n.id, { markdown: md, meta: p.meta })
      changed.push(n.id)
    } catch (e) {
      log.warn('Link güncellenemedi', e instanceof Error ? e.message : 'bilinmeyen')
    }
  }
  return changed
}
