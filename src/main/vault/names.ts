import { readdir } from 'node:fs/promises'
import { mainT } from '../i18n'

// Windows'un dosya adında yasakladığı karakterler okunur benzerleriyle değiştirilir
const WIN_CHARS: Record<string, string> = { '?': '？', '*': '∗', '"': '”', '<': '‹', '>': '›', '|': 'ǀ', '\\': '⧵' }
const WIN_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i

// Başlığı dosya adı olarak güvenli hale getirir (macOS; Windows'ta ek kurallar)
export function sanitizeTitle(title: string, platform: string = process.platform): string {
  let t = title
    .normalize('NFC')
    .replace(/\//g, '∕')
    .replace(/:/g, '꞉')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .replace(/^\.+/, '')
    .trim()
  if (t.length > 120) t = t.slice(0, 120)
  if (platform === 'win32') {
    t = t.replace(/[?*"<>|\\]/g, (c) => WIN_CHARS[c]!).replace(/[. ]+$/, '')
    if (WIN_RESERVED.test(t)) t += '_'
  }
  return t || mainT('page.untitled')
}

import { foldKey } from '@core/fold'

export { foldKey }
const key = foldKey

// APFS varsayılan olarak büyük/küçük harfe duyarsızdır; karşılaştırma buna göre yapılır
export async function uniqueName(dir: string, base: string, ext: '.md' | '', taken: Set<string> = new Set()): Promise<string> {
  let existing: string[] = []
  try {
    existing = await readdir(dir)
  } catch {
    // klasör henüz yok
  }
  const used = new Set([...existing, ...taken].map(key))
  let name = base
  let n = 2
  while (used.has(key(name + ext))) name = `${base} (${n++})`
  return name
}
