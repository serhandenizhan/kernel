import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('make-icon', () => {
  it('SVG logodan macOS .icns üretir (10 boyut)', () => {
    const out = mkdtempSync(join(tmpdir(), 'kernel-icon-'))
    const icns = join(out, 'icon.icns')
    execFileSync('node', ['scripts/make-icon.mjs', 'build/icon.svg', icns], { stdio: 'pipe' })
    expect(existsSync(icns)).toBe(true)
    const iconset = join(out, 'check.iconset')
    execFileSync('iconutil', ['-c', 'iconset', icns, '-o', iconset])
    expect(readdirSync(iconset).sort()).toEqual(
      ['icon_16x16.png', 'icon_16x16@2x.png', 'icon_32x32.png', 'icon_32x32@2x.png', 'icon_128x128.png', 'icon_128x128@2x.png', 'icon_256x256.png', 'icon_256x256@2x.png', 'icon_512x512.png', 'icon_512x512@2x.png'].sort()
    )
  }, 60_000)
})
