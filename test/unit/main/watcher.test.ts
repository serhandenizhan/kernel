import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Vault } from '../../../src/main/vault/vault'
import { watchVault, type VaultEvent } from '../../../src/main/vault/watcher'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('watchVault', () => {
  it('dış değişikliği bildirir, kendi yazımlarını yok sayar', async () => {
    const root = mkdtempSync(join(tmpdir(), 'kernel-watch-'))
    const v = new Vault(root)
    await v.init()
    const a = await v.create(null, 'A')
    const events: VaultEvent[] = []
    const stop = await watchVault(v, (e) => events.push(e))
    await wait(300)
    await v.write(a.id, { markdown: 'kendi yazımım', meta: (await v.read(a.id)).meta })
    await wait(800)
    expect(events).toEqual([])
    writeFileSync(join(root, 'A.md'), `---\nid: ${a.id}\n---\ndışarıdan`)
    await wait(1200)
    expect(events).toContainEqual({ type: 'page-changed', id: a.id })
    writeFileSync(join(root, 'Yeni.md'), 'x')
    await wait(1200)
    expect(events).toContainEqual({ type: 'tree-changed' })
    await stop()
  }, 10_000)
})
