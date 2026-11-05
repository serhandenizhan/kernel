import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : n.endsWith('.ts') ? [join(dir, n)] : []))

describe('Anahtar Zinciri', () => {
  it('ana süreç Electron safeStorage kullanmaz (macOS parola penceresi açılmasın)', () => {
    const users = walk('src/main').filter((f) => /safeStorage/.test(readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')))
    expect(users).toEqual([])
  })
  it('Chromium sahte anahtar zinciriyle başlatılır', () => {
    expect(readFileSync('src/main/index.ts', 'utf8')).toMatch(/appendSwitch\('use-mock-keychain'\)/)
  })
})
