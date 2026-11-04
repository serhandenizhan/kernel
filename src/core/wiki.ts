import type { TreeNode } from '@shared/types'
import { foldKey } from './fold'

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
