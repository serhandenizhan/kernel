import { watch } from 'chokidar'
import { statSync } from 'node:fs'
import { basename, relative, sep } from 'node:path'
import type { Vault } from './vault'

export type VaultEvent = { type: 'tree-changed' } | { type: 'page-changed'; id: string }

// Kasadaki dış değişiklikleri izler (örn. dosya VS Code'da düzenlendi)
export async function watchVault(vault: Vault, emit: (e: VaultEvent) => void): Promise<() => Promise<void>> {
  let treeTimer: NodeJS.Timeout | null = null
  const isOwn = (p: string) => {
    const m = vault.recentWrites.get(p)
    if (m === undefined) return false
    try {
      return statSync(p).mtimeMs === m
    } catch {
      return false
    }
  }
  const treeChanged = () => {
    if (treeTimer) clearTimeout(treeTimer)
    treeTimer = setTimeout(async () => {
      await vault.reindex()
      emit({ type: 'tree-changed' })
    }, 150)
  }

  const watcher = watch(vault.root, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    ignored: (p: string) => {
      const rel = relative(vault.root, p)
      if (!rel) return false
      const parts = rel.split(sep)
      return parts.some((x) => x.startsWith('.')) || parts[0] === 'attachments' || /\.tmp$/.test(p)
    }
  })

  watcher.on('change', (p) => {
    if (!p.endsWith('.md') || isOwn(p)) return
    const id = vault.idOf(p)
    if (id) emit({ type: 'page-changed', id })
    else treeChanged()
  })
  for (const ev of ['add', 'unlink', 'addDir', 'unlinkDir'] as const) {
    watcher.on(ev, (p: string) => {
      if (isOwn(p)) return
      if ((ev === 'add' || ev === 'unlink') && !basename(p).endsWith('.md')) return
      treeChanged()
    })
  }
  await new Promise<void>((r) => watcher.once('ready', () => r()))
  return async () => {
    if (treeTimer) clearTimeout(treeTimer)
    await watcher.close()
  }
}
