import { parse, stringify } from 'yaml'
import type { PageMeta } from '@shared/types'

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
const ORDER: (keyof PageMeta)[] = ['id', 'icon', 'cover', 'coverPosition', 'created', 'updated', 'tags']

export function splitFrontmatter(text: string): { meta: Record<string, unknown>; body: string } {
  const m = FM.exec(text)
  if (!m) return { meta: {}, body: text }
  const body = text.slice(m[0].length)
  try {
    const meta = parse(m[1] ?? '')
    return { meta: meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {}, body }
  } catch {
    // bozuk YAML: gövdeyi koru, meta boş
    return { meta: {}, body }
  }
}

export function joinFrontmatter(meta: PageMeta, body: string): string {
  const ordered: Record<string, unknown> = {}
  for (const k of ORDER) if (meta[k] !== undefined) ordered[k] = meta[k]
  return `---\n${stringify(ordered, { lineWidth: 0 })}---\n${body}`
}
