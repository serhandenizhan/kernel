import type { BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, extname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import type { PdfOptions } from '@shared/types'
import type { Vault } from './vault/vault'
import { writeAtomic } from './vault/atomic'
import { descendants, openPrintWindow } from './pdf'

const ATTACH_RE = /(?:\]\(<?|!\[\[|^cover:\s*|^icon:\s*)(attachments\/[^)>\]\n]+?)(?:>?\)|\]\]|\s*$)/gm

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Markdown (frontmatter dahil) metninde geçen attachments/… yolları (kodlanmış olanlar çözülür) */
export function referencedAttachments(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(ATTACH_RE)) out.add(safeDecode(m[1]!.trim().replace(/^"|"$/g, '')))
  return [...out]
}

// Sayfa (ve isteğe bağlı alt sayfaları) + kullandıkları ekler → zip; yapı kasadaki göreli yollarla korunur
export async function exportMarkdownZip(vault: Vault, id: string, includeSubpages: boolean, target: string): Promise<string> {
  const ids = includeSubpages ? [id, ...descendants(await vault.tree(), id)] : [id]
  const base = dirname(vault.pathOf(id))
  const files: Record<string, Uint8Array> = {}
  const attachments = new Set<string>()
  for (const pid of ids) {
    const abs = vault.pathOf(pid)
    const text = await readFile(abs, 'utf8')
    files[relative(base, abs).split(sep).join('/')] = new TextEncoder().encode(text)
    for (const a of referencedAttachments(text)) attachments.add(a)
  }
  for (const a of attachments) {
    const abs = join(vault.root, a)
    if (existsSync(abs)) files[a] = new Uint8Array(await readFile(abs))
  }
  await writeAtomic(target, zipSync(files, { level: 6 }))
  return target
}

const MIME: Record<string, string> = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' }

/** CSS'teki göreli/dosya url()'lerini (KaTeX fontları vb.) data: URI'ye çevirir */
async function inlineAssetUrls(html: string): Promise<string> {
  const rendererDir = join(__dirname, '../renderer')
  const urls = new Set<string>()
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (!/^(data:|https?:|#)/.test(m[1]!)) urls.add(m[1]!)
  let out = html
  for (const u of urls) {
    const abs = u.startsWith('file:') ? fileURLToPath(u) : join(rendererDir, u.replace(/^\.?\//, ''))
    if (!existsSync(abs)) continue
    const data = (await readFile(abs)).toString('base64')
    out = out.split(u).join(`data:${MIME[extname(abs)] ?? 'application/octet-stream'};base64,${data}`)
  }
  return out
}

// Tek dosyalık HTML: baskı görünümü, stiller ve görseller satır içi, betik yok
export async function exportHtml(vault: Vault, id: string, options: PdfOptions, target: string): Promise<string> {
  let win: BrowserWindow | null = null
  try {
    win = await openPrintWindow(vault, id, options)
    const html = (await win.webContents.executeJavaScript('window.kernelSnapshotHtml()')) as string
    await writeAtomic(target, await inlineAssetUrls(html))
    return target
  } finally {
    win?.destroy()
  }
}
