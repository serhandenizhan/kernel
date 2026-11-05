import type { GraphData } from '@shared/types'

/** Yerel graf: sayfa ve `depth` adım içindeki komşuları (link yönü fark etmez) */
export function localGraph(g: GraphData, id: string, depth = 1): GraphData {
  if (!g.nodes.some((n) => n.id === id)) return { nodes: [], links: [] }
  const keep = new Set([id])
  let frontier = new Set([id])
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>()
    for (const l of g.links) {
      if (frontier.has(l.source) && !keep.has(l.target)) next.add(l.target)
      if (frontier.has(l.target) && !keep.has(l.source)) next.add(l.source)
    }
    next.forEach((x) => keep.add(x))
    frontier = next
  }
  return { nodes: g.nodes.filter((n) => keep.has(n.id)), links: g.links.filter((l) => keep.has(l.source) && keep.has(l.target)) }
}

/** Üst klasör → renk sırası: kök sayfalar 0, klasörler alfabetik 1, 2, … (renk sayısına göre döner) */
export function folderColorIndex(nodes: GraphData['nodes'], colors: number): Map<string, number> {
  const folders = [...new Set(nodes.map((n) => n.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const out = new Map<string, number>([['', 0]])
  folders.forEach((f, i) => out.set(f, 1 + (i % Math.max(1, colors - 1))))
  return out
}
