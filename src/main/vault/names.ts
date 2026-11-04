import { readdir } from 'node:fs/promises'

// Başlığı macOS dosya adı olarak güvenli hale getirir
export function sanitizeTitle(title: string): string {
  let t = title
    .normalize('NFC')
    .replace(/\//g, '∕')
    .replace(/:/g, '꞉')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .replace(/^\.+/, '')
    .trim()
  if (t.length > 120) t = t.slice(0, 120)
  return t || 'Adsız'
}

const key = (s: string) => s.normalize('NFC').toLocaleLowerCase('tr')

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
