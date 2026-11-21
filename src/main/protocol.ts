import { realpathSync, statSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

export const VAULT_SCHEME = 'kernel-file'

export const inside = (root: string, p: string): boolean => {
  const r = relative(root, p)
  return r !== '' && r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r)
}

/** Kasa içi göreli yolu doğrular: .., mutlak yol, dizin ve kasa dışına çıkan sembolik link reddedilir */
export function resolveVaultPath(root: string, relPath: string): string | null {
  const rel = relPath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!rel || rel.split('/').includes('..') || isAbsolute(relPath)) return null
  const abs = resolve(join(root, rel))
  if (!inside(resolve(root), abs)) return null
  try {
    // sembolik linkler kasa dışını gösteremez; yalnızca normal dosya okunur
    const real = realpathSync(abs)
    if (!inside(realpathSync(root), real)) return null
    if (!statSync(real).isFile()) return null
  } catch {
    return null
  }
  return abs.split('/').join(sep)
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
  return resolveVaultPath(root, rel)
}
