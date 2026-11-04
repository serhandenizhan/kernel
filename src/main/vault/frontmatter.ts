import { parse, stringify } from 'yaml'
import type { PageMeta } from '@shared/types'

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
export const KNOWN_KEYS: (keyof PageMeta)[] = ['id', 'icon', 'cover', 'coverPosition', 'created', 'updated', 'tags']

export function splitFrontmatter(text: string): { meta: Record<string, unknown>; body: string; error?: true } {
  const m = FM.exec(text)
  if (!m) return { meta: {}, body: text }
  const body = text.slice(m[0].length)
  try {
    const meta = parse(m[1] ?? '')
    return { meta: meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {}, body }
  } catch {
    // bozuk YAML: gövdeyi koru, meta boş; çağıran dosyayı değiştirmemeli
    return { meta: {}, body, error: true }
  }
}

/** Kernel'in tanımadığı alanlar (Obsidian'ın aliases, date vb.) — kayıtta korunur */
export function extraKeys(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) if (!(KNOWN_KEYS as string[]).includes(k)) out[k] = v
  return out
}

export function joinFrontmatter(meta: PageMeta, body: string, extra: Record<string, unknown> = {}): string {
  const ordered: Record<string, unknown> = {}
  for (const k of KNOWN_KEYS) if (meta[k] !== undefined) ordered[k] = meta[k]
  for (const [k, v] of Object.entries(extra)) if (!(k in ordered)) ordered[k] = v
  return `---\n${stringify(ordered, { lineWidth: 0 })}---\n${body}`
}
