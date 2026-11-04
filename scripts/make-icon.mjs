// SVG logodan macOS .icns üretir: sharp ile PNG boyutları → iconutil
// Kullanım: node scripts/make-icon.mjs build/icon.svg build/icon.icns
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const [src = 'build/icon.svg', out = 'build/icon.icns'] = process.argv.slice(2)
const svg = readFileSync(src)
const work = mkdtempSync(join(tmpdir(), 'kernel-iconset-'))
const iconset = join(work, 'icon.iconset')
mkdirSync(iconset)

const sizes = [16, 32, 128, 256, 512]
for (const size of sizes) {
  for (const scale of [1, 2]) {
    const px = size * scale
    const name = scale === 1 ? `icon_${size}x${size}.png` : `icon_${size}x${size}@2x.png`
    await sharp(svg, { density: Math.max(72, (72 * px) / 1024) * 4 })
      .resize(px, px)
      .png()
      .toFile(join(iconset, name))
  }
}

execFileSync('iconutil', ['-c', 'icns', iconset, '-o', out])
rmSync(work, { recursive: true, force: true })
console.log(`İkon üretildi: ${out}`)
