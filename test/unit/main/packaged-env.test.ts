import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function walkTs(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walkTs(p, out)
    else if (e.isFile() && e.name.endsWith('.ts')) out.push(p)
  }
  return out
}

const ALLOWED = new Set(['src/main/env.ts', 'src/main/updates.ts', 'src/main/window-options.ts'])
const HOOK_RE = /process\.env\[['"](?:KERNEL_TEST[^'"]*|KERNEL_VAULT|KERNEL_USER_DATA|ELECTRON_RENDERER_URL)['"]\]/

describe('paketli uygulamada test ortam kancaları', () => {
  it('src/main altındaki dosyalar env.ts dışından doğrudan test env değişkeni okumaz', () => {
    const hits: string[] = []
    for (const f of walkTs('src/main')) {
      const rel = f.replace(/\\/g, '/')
      if (ALLOWED.has(rel)) continue
      const src = readFileSync(f, 'utf8')
      if (HOOK_RE.test(src) || /isHeadlessTest\(\s*process\.env\s*\)/.test(src)) hits.push(rel)
    }
    expect(hits).toEqual([])
  })
})
