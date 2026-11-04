import { BrowserWindow } from 'electron'
import { rename, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { PdfOptions, TreeNode } from '@shared/types'
import type { Vault } from './vault/vault'
import { log } from './log'

const MARGINS: Record<PdfOptions['margin'], number> = { narrow: 0.4, normal: 0.75, wide: 1.0 } // inç
const READY_TIMEOUT_MS = 20_000

export function descendants(nodes: TreeNode[], id: string): string[] {
  for (const n of nodes) {
    if (n.id === id) {
      const out: string[] = []
      const walk = (c: TreeNode[]) => c.forEach((x) => (out.push(x.id), walk(x.children)))
      walk(n.children)
      return out
    }
    const inner = descendants(n.children, id)
    if (inner.length) return inner
  }
  return []
}

async function waitReady(win: BrowserWindow): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < READY_TIMEOUT_MS) {
    const state = (await win.webContents.executeJavaScript('({ ready: window.kernelPrintReady === true, error: window.kernelPrintError ?? null })')) as { ready: boolean; error: string | null }
    if (state.error) throw new Error(state.error)
    if (state.ready) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('Sayfa baskıya hazırlanamadı (zaman aşımı). Bir görsel ya da formül yüklenemiyor olabilir.')
}

/** Arayüzün baskı görünümünü (#/print) gizli pencerede açar ve hazır olmasını bekler */
export async function openPrintWindow(vault: Vault, id: string, options: PdfOptions): Promise<BrowserWindow> {
  const ids = options.includeSubpages ? [id, ...descendants(await vault.tree(), id)] : [id]
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    webPreferences: { preload: join(__dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  const hash = `/print?ids=${encodeURIComponent(ids.join(','))}&opts=${encodeURIComponent(JSON.stringify(options))}`
  try {
    if (process.env['ELECTRON_RENDERER_URL']) await win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hash}`)
    else await win.loadFile(join(__dirname, '../renderer/index.html'), { hash })
    await waitReady(win)
    return win
  } catch (e) {
    win.destroy()
    throw e
  }
}

// Sayfayı (ve isteğe bağlı alt sayfalarını) arayüzün kendi baskı görünümüyle PDF'e çevirir
export async function exportPdf(vault: Vault, id: string, options: PdfOptions, savePath: string): Promise<string> {
  const tmp = `${savePath}.${process.pid}.tmp`
  let win: BrowserWindow | null = null
  try {
    win = await openPrintWindow(vault, id, options)
    const margin = MARGINS[options.margin]
    const pdf = await win.webContents.printToPDF({
      pageSize: options.pageSize,
      printBackground: true,
      generateDocumentOutline: true,
      generateTaggedPDF: true,
      margins: { top: margin, bottom: Math.max(margin, options.pageNumbers ? 0.6 : 0), left: margin, right: margin },
      displayHeaderFooter: options.pageNumbers,
      headerTemplate: '<div></div>',
      footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#777;font-family:-apple-system,sans-serif"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
    })
    // yarım PDF bırakma: önce geçici dosya, sonra yerine taşı
    await writeFile(tmp, pdf)
    await rename(tmp, savePath)
    return savePath
  } catch (e) {
    await rm(tmp, { force: true })
    log.error('PDF export hatası', e)
    throw e
  } finally {
    win?.destroy()
  }
}
