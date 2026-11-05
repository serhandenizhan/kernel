import type { TreeNode } from '@shared/types'
import { foldKey } from './fold'
import { normalizeTr } from './normalize-tr'

/** [[Hedef]] → sayfa kimliği: önce yol ("A/B"), sonra başlık (büyük/küçük harf duyarsız); bulunamazsa null */
export function resolveWikiTarget(tree: TreeNode[], target: string): string | null {
  const t = foldKey(target.trim().replace(/\.md$/i, ''))
  let byTitle: string | null = null
  const walk = (nodes: TreeNode[]): string | null => {
    for (const n of nodes) {
      if (foldKey(n.path.replace(/\.md$/i, '')) === t) return n.id
      if (byTitle === null && foldKey(n.title) === t) byTitle = n.id
      const found = walk(n.children)
      if (found) return found
    }
    return null
  }
  return walk(tree) ?? byTitle
}

function flat(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    out.push(n)
    flat(n.children, out)
  }
  return out
}

/** [[ seçicisi için sayfa filtresi: başlığı sorguyla başlayanlar önce, sonra içerenler, sonra yolda geçenler */
export function filterPages(tree: TreeNode[], query: string, limit = 8): TreeNode[] {
  const all = flat(tree)
  // Türkçe harfler katlanır: "ozde" → "Özdeğerler"
  const q = normalizeTr(query.trim())
  if (!q) return all.slice(0, limit)
  const score = (n: TreeNode): number => {
    const t = normalizeTr(n.title)
    if (t.startsWith(q)) return 0
    if (t.split(/\s+/).some((w) => w.startsWith(q))) return 1
    if (t.includes(q)) return 2
    if (normalizeTr(n.path).includes(q)) return 3
    return -1
  }
  return all
    .map((n) => ({ n, s: score(n) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => a.s - b.s)
    .slice(0, limit)
    .map((x) => x.n)
}

/** Sayfaya yazılacak link hedefi: başlık tekilse başlık, başka sayfayla çakışıyorsa yol (uzantısız) */
export function linkTargetFor(tree: TreeNode[], id: string): string {
  const all = flat(tree)
  const page = all.find((n) => n.id === id)
  if (!page) return ''
  const clash = all.some((n) => n.id !== id && foldKey(n.title) === foldKey(page.title))
  return clash ? page.path.replace(/\.md$/i, '') : page.title
}
