import { describe, it, expect, beforeEach } from 'vitest'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { unzipSync } from 'fflate'
import { makeBackup, BackupScheduler } from '../../../src/main/backup'
import { DEFAULT_SETTINGS, type Settings } from '@shared/types'

let root: string
let out: string
const entries = (zip: string) => Object.keys(unzipSync(readFileSync(zip))).sort()

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kernel-bk-vault-'))
  out = mkdtempSync(join(tmpdir(), 'kernel-bk-out-'))
  writeFileSync(join(root, 'A.md'), 'a')
  mkdirSync(join(root, 'A'))
  writeFileSync(join(root, 'A', 'B.md'), 'b')
  mkdirSync(join(root, 'attachments'))
  writeFileSync(join(root, 'attachments', 'x.png'), 'png')
  mkdirSync(join(root, '.kernel'))
  writeFileSync(join(root, '.kernel', 'search-index.json'), '{}')
  writeFileSync(join(root, '.kernel', 'settings.json'), '{}')
})

describe('makeBackup', () => {
  it('kasayı zipler, arama önbelleğini dışarıda bırakır', async () => {
    const zip = await makeBackup(root, out, 14, new Date(Date.UTC(2026, 10, 4, 9, 30)))
    expect(zip).toMatch(/Kernel-yedek-2026-11-04-\d{4}\.zip$/)
    const e = entries(zip)
    expect(e).toEqual(expect.arrayContaining(['A.md', 'A/B.md', 'attachments/x.png', '.kernel/settings.json']))
    expect(e).not.toContain('.kernel/search-index.json')
  })
  it('kasanın içindeki yedek klasörünü yedeğe koymaz', async () => {
    const inside = join(root, 'Yedekler')
    mkdirSync(inside)
    writeFileSync(join(inside, 'eski.zip'), 'z')
    const zip = await makeBackup(root, inside, 14)
    expect(entries(zip).some((e) => e.startsWith('Yedekler/'))).toBe(false)
  })
  it('yedek klasörü kasanın kendisiyse önceki yedekler zip\'e girmez', async () => {
    await makeBackup(root, root, 14, new Date(Date.UTC(2026, 10, 1, 8, 0)))
    const zip = await makeBackup(root, root, 14, new Date(Date.UTC(2026, 10, 2, 8, 0)))
    expect(entries(zip).some((e) => /Kernel-yedek-/.test(e))).toBe(false)
    expect(entries(zip)).toContain('A.md')
  })
  it('keep 0 olsa da yeni yedek silinmez', async () => {
    const zip = await makeBackup(root, out, 0)
    expect(readdirSync(out)).toContain(basename(zip))
  })
  it('sıkıştırılmış medya yeniden sıkıştırılmaz (olduğu gibi saklanır), içerik doğru', async () => {
    const big = Buffer.alloc(200_000, 7)
    writeFileSync(join(root, 'attachments', 'büyük.png'), big)
    const zip = await makeBackup(root, out, 14)
    expect(Buffer.from(unzipSync(readFileSync(zip))['attachments/büyük.png']!)).toEqual(big)
    // png "stored": zip boyutu en az ham dosya kadar
    expect(readFileSync(zip).length).toBeGreaterThan(big.length)
  })
  it('keep aşılınca yalnızca en eski Kernel yedeğini siler', async () => {
    writeFileSync(join(out, 'notlarım.txt'), 'dokunma')
    for (let i = 1; i <= 3; i++) await makeBackup(root, out, 2, new Date(Date.UTC(2026, 10, i, 8, 0)))
    const names = readdirSync(out).sort()
    expect(names.filter((n) => n.endsWith('.zip')).length).toBe(2)
    expect(names).toContain('notlarım.txt')
    expect(names.some((n) => n.includes('2026-11-01'))).toBe(false)
  })
})

describe('BackupScheduler', () => {
  const settingsWith = (patch: Partial<Settings['backup']>): Settings => ({ ...DEFAULT_SETTINGS, backup: { ...DEFAULT_SETTINGS.backup, ...patch } })
  it('kapalıysa ya da 24 saat dolmadıysa atlar, dolduysa yedekler, klasör yoksa hata bildirir', async () => {
    let clock = Date.UTC(2026, 10, 4, 12, 0)
    const errors: string[] = []
    let settings = settingsWith({ enabled: false, folder: out })
    const s = new BackupScheduler(() => ({ root, settings }), (m) => errors.push(m), () => new Date(clock))
    expect(await s.tick()).toBe('skipped')
    settings = settingsWith({ enabled: true, folder: out })
    expect(await s.tick()).toBe('done')
    clock += 2 * 3_600_000
    expect(await s.tick()).toBe('skipped')
    clock += 23 * 3_600_000
    expect(await s.tick()).toBe('done')
    settings = settingsWith({ enabled: true, folder: join(out, 'yok', 'olmayan') })
    clock += 25 * 3_600_000
    expect(await s.tick()).toBe('failed')
    expect(errors[0]).toContain('Yedek alınamadı')
  })
})
