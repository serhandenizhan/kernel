import type { BrowserWindow } from 'electron'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import type { PdfOptions } from '@shared/types'
import type { Vault } from './vault/vault'
import { writeAtomic } from './vault/atomic'
import { descendants, openPrintWindow } from './pdf'
import { inside, resolveVaultPath } from './protocol'

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
  let attachRoot: string | null = null
  try {
    attachRoot = realpathSync(join(vault.root, 'attachments'))
  } catch {
    attachRoot = null
  }
  for (const a of attachments) {
    const norm = a.replace(/\\/g, '/')
    if (!attachRoot || !norm.startsWith('attachments/') || norm.split('/').includes('..') || isAbsolute(norm)) continue
    const abs = resolveVaultPath(vault.root, norm)
    if (!abs) continue
    try {
      const real = realpathSync(abs)
      if (!inside(attachRoot, real)) continue
      files[norm] = new Uint8Array(await readFile(real))
    } catch {
      // erişilemeyen dosya atlanır
    }
  }
  await writeAtomic(target, zipSync(files, { level: 6 }))
  return target
}

const MIME: Record<string, string> = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' }

/** CSS'teki göreli/dosya url()'lerini (KaTeX fontları vb.) data: URI'ye çevirir; yalnızca <style> içindeki renderer varlıkları gömülür */
export async function inlineAssetUrls(html: string, rendererDir = join(__dirname, '../renderer')): Promise<string> {
  let realBase: string
  try {
    realBase = realpathSync(rendererDir)
  } catch {
    return html
  }
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  let out = ''
  let last = 0
  for (const sm of html.matchAll(styleRe)) {
    const idx = sm.index!
    out += html.slice(last, idx)
    const openEnd = html.indexOf('>', idx) + 1
    out += html.slice(idx, openEnd)
    let css = sm[1]!
    const urls = new Set<string>()
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (!/^(data:|https?:|#)/.test(m[1]!)) urls.add(m[1]!)
    for (const u of urls) {
      let abs: string
      try {
        if (u.startsWith('file:')) abs = fileURLToPath(u)
        else {
          if (isAbsolute(u) || u.split(/[\\/]/).includes('..')) continue
          abs = resolve(rendererDir, u.replace(/^\.?\//, ''))
        }
        if (!existsSync(abs)) continue
        const real = realpathSync(abs)
        if (!inside(realBase, real) || !statSync(real).isFile()) continue
        const data = (await readFile(real)).toString('base64')
        css = css.split(u).join(`data:${MIME[extname(real)] ?? 'application/octet-stream'};base64,${data}`)
      } catch {
        // geçersiz veya izin verilmeyen yol gömülmez
      }
    }
    out += `${css}</style>`
    last = idx + sm[0].length
  }
  out += html.slice(last)
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
