import { realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

export const VAULT_SCHEME = 'kernel-file'

const inside = (root: string, p: string) => {
  const r = relative(root, p)
  return r !== '' && !r.startsWith('..') && !isAbsolute(r)
}

// kernel-file://vault/<yol> adresini kasa içindeki mutlak yola çevirir; kasa dışı her şey null
export function resolveVaultUrl(root: string, url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== `${VAULT_SCHEME}:` || parsed.hostname !== 'vault') return null
  let rel: string
  try {
    rel = decodeURIComponent(parsed.pathname).replace(/^\/+/, '')
  } catch {
    return null
  }
  if (!rel || rel.split(/[\\/]/).includes('..') || isAbsolute(rel)) return null
  const abs = resolve(join(root, rel))
  if (!inside(resolve(root), abs)) return null
  try {
    // sembolik linkler kasa dışını gösteremez
    const real = realpathSync(abs)
    if (!inside(realpathSync(root), real)) return null
  } catch {
    return null
  }
  return abs.split('/').join(sep)
}
