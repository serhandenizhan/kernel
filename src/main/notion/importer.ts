import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { JSONContent } from '@tiptap/core'
import type { NotionBlock, NotionFile, NotionPage, NotionRichText } from '@core/notion/types'
import { convertBlocks, countBlocks, countDocBlocks, pageMeta, pageTitleOf, type ConvertContext, type DatabaseData } from '@core/notion/convert'
import { formatNotionDate, plainText } from '@core/notion/rich-text'
import { docToMarkdown } from '@core/markdown/serialize'
import { foldKey } from '@core/fold'
import type { Vault } from '../vault/vault'
import { writeAtomic } from '../vault/atomic'
import type { NotionApi } from './fixture-client'

export interface ImportReport {
  rootPageId: string
  pages: number
  files: number
  failedFiles: { page: string; url: string }[]
  unsupported: { page: string; type: string }[]
  notes: string[]
  mismatches: { page: string; notion: number; kernel: number }[]
}

export type ImportProgress = { phase: 'scanning' | 'importing' | 'done' | 'error' | 'canceled'; pagesDone: number; pagesTotal: number; current?: string; report?: ImportReport; error?: string }

interface ImportState {
  date: string
  rootIds: string[]
  rootKernelId: string | null
  /** Notion sayfa kimliği → Kernel sayfa kimliği (oluşturulanlar) */
  pages: Record<string, string>
  /** içeriği yazılmış sayfalar */
  done: string[]
}

interface PageInfo {
  notionId: string
  parent: string | null
  title: string
  page: NotionPage
  blocks: NotionBlock[]
}

const FILE_TYPES = new Set(['image', 'file', 'pdf', 'video', 'audio'])
const pad = (n: number) => String(n).padStart(2, '0')

function hintOf(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '')
    return last.replace(/\.[^.]+$/, '') || 'notion'
  } catch {
    return 'notion'
  }
}

function propText(p: { type: string; [k: string]: unknown }): string {
  const v = p[p.type] as unknown
  switch (p.type) {
    case 'title':
    case 'rich_text':
      return plainText(v as NotionRichText[])
    case 'number':
      return v === null || v === undefined ? '' : String(v)
    case 'select':
    case 'status':
      return (v as { name?: string } | null)?.name ?? ''
    case 'multi_select':
      return ((v as { name: string }[]) ?? []).map((x) => x.name).join(', ')
    case 'date':
      return (v as { start?: string } | null)?.start ? formatNotionDate((v as { start: string }).start) : ''
    case 'checkbox':
      return v ? '✓' : '✗'
    case 'people':
      return ((v as { name?: string }[]) ?? []).map((x) => x.name ?? '').join(', ')
    case 'url':
    case 'email':
    case 'phone_number':
      return (v as string | null) ?? ''
    default:
      return ''
  }
}

// Notion → Kernel aktarıcı: tara (dosyaları anında indir) → sayfaları oluştur → içerikleri yaz → rapor.
// Her adım .kernel/notion-import.json'a işlenir; kesilirse resume() kaldığı yerden sürer.
export class NotionImporter {
  private canceled = false
  private files = new Map<string, string>()

  constructor(
    private readonly deps: {
      client: NotionApi
      vault: Vault
      download: (url: string, nameHint: string) => Promise<string | null>
      today?: () => Date
      onProgress: (p: ImportProgress) => void
    }
  ) {}

  private get stateFile(): string {
    return join(this.deps.vault.root, '.kernel', 'notion-import.json')
  }

  private async saveState(s: ImportState): Promise<void> {
    await writeAtomic(this.stateFile, JSON.stringify(s, null, 2))
  }

  static async pending(vault: Vault): Promise<boolean> {
    return existsSync(join(vault.root, '.kernel', 'notion-import.json'))
  }

  cancel(): void {
    this.canceled = true
  }

  async run(rootIds: string[]): Promise<ImportReport> {
    const d = (this.deps.today ?? (() => new Date()))()
    const state: ImportState = { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, rootIds, rootKernelId: null, pages: {}, done: [] }
    await this.saveState(state)
    return this.execute(state)
  }

  async resume(): Promise<ImportReport | null> {
    if (!existsSync(this.stateFile)) return null
    return this.execute(JSON.parse(await readFile(this.stateFile, 'utf8')) as ImportState)
  }

  private async download(url: string | null | undefined): Promise<void> {
    if (!url || this.files.has(url)) return
    const local = await this.deps.download(url, hintOf(url))
    if (local) this.files.set(url, local)
  }

  /** Blokları özyinelemeli çeker; dosyaları okundukları anda indirir (Notion linkleri 1 saatte geçersizleşir) */
  private async fetchBlocks(id: string, withFiles: boolean): Promise<NotionBlock[]> {
    const out: NotionBlock[] = []
    let cursor: string | undefined
    do {
      const res = await this.deps.client.children(id, cursor)
      out.push(...res.results)
      cursor = res.next_cursor ?? undefined
    } while (cursor)
    for (const b of out) {
      const data = (b[b.type] ?? {}) as Record<string, unknown>
      if (b.type === 'synced_block' && (data['synced_from'] as { block_id?: string } | null)?.block_id) {
        b.children = await this.fetchBlocks((data['synced_from'] as { block_id: string }).block_id, withFiles)
      } else if (b.type === 'child_database') {
        b['database'] = await this.fetchDatabase(b.id, String(data['title'] ?? ''))
      } else if (b.has_children && b.type !== 'child_page') {
        b.children = await this.fetchBlocks(b.id, withFiles)
      }
      if (withFiles && FILE_TYPES.has(b.type)) {
        const f = data as unknown as NotionFile
        if (!(b.type === 'video' && f.type === 'external')) await this.download(f.file?.url ?? f.external?.url)
      }
    }
    return out
  }

  private async fetchDatabase(id: string, title: string): Promise<DatabaseData | undefined> {
    try {
      const db = await this.deps.client.database(id)
      const props = Object.entries(db.properties)
      const titleCol = props.find(([, p]) => p.type === 'title')?.[0]
      const columns = [...(titleCol ? [titleCol] : []), ...props.map(([k]) => k).filter((k) => k !== titleCol).sort((a, b) => a.localeCompare(b, 'tr'))]
      const rows: string[][] = []
      let cursor: string | undefined
      do {
        const res = await this.deps.client.queryDatabase(id, cursor)
        for (const r of res.results) rows.push(columns.map((c) => (r.properties[c] ? propText(r.properties[c]!) : '')))
        cursor = res.next_cursor ?? undefined
      } while (cursor)
      return { title: plainText(db.title) || title, columns, rows }
    } catch {
      return undefined
    }
  }

  private async execute(state: ImportState): Promise<ImportReport> {
    const { client, vault, onProgress } = this.deps
    const report: ImportReport = { rootPageId: state.rootKernelId ?? '', pages: 0, files: 0, failedFiles: [], unsupported: [], notes: [], mismatches: [] }
    const infos: PageInfo[] = []
    try {
      // 1) tarama + dosya indirme
      const queue: { id: string; parent: string | null }[] = state.rootIds.map((id) => ({ id, parent: null }))
      while (queue.length) {
        const { id, parent } = queue.shift()!
        onProgress({ phase: 'scanning', pagesDone: infos.length, pagesTotal: infos.length + queue.length + 1 })
        const page = await client.page(id)
        const withFiles = !state.done.includes(id)
        const blocks = await this.fetchBlocks(id, withFiles)
        if (withFiles) {
          if (page.icon && page.icon.type !== 'emoji') await this.download((page.icon as NotionFile).file?.url ?? (page.icon as NotionFile).external?.url)
          await this.download(page.cover?.file?.url ?? page.cover?.external?.url)
        }
        infos.push({ notionId: id, parent, title: pageTitleOf(page) || 'Adsız', page, blocks })
        for (const b of blocks) if (b.type === 'child_page') queue.push({ id: b.id, parent: id })
      }

      // 2) kök ve tüm sayfaları oluştur (wiki link hedefleri için başlıklar önceden belli olmalı)
      if (!state.rootKernelId || !this.exists(state.rootKernelId)) {
        state.rootKernelId = (await vault.create(null, `Notion içe aktarım (${state.date})`)).id
        await this.saveState(state)
      }
      report.rootPageId = state.rootKernelId
      for (const info of infos) {
        if (state.pages[info.notionId] && this.exists(state.pages[info.notionId]!)) continue
        const parentKernel = info.parent ? state.pages[info.parent]! : state.rootKernelId
        state.pages[info.notionId] = (await vault.create(parentKernel, info.title)).id
        await this.saveState(state)
      }
      const targets = await this.wikiTargets(state, infos)

      // 3) içerikleri yaz
      for (const info of infos) {
        const kernelId = state.pages[info.notionId]!
        const title = (await vault.read(kernelId)).title
        if (state.done.includes(info.notionId)) {
          report.pages++
          continue
        }
        if (this.canceled) {
          onProgress({ phase: 'canceled', pagesDone: state.done.length, pagesTotal: infos.length })
          report.notes.push('Aktarım durduruldu; "Devam et" ile kaldığı yerden sürer.')
          return report
        }
        onProgress({ phase: 'importing', pagesDone: state.done.length, pagesTotal: infos.length, current: title })
        let explained = false
        const ctx: ConvertContext = {
          file: (url) => this.files.get(url) ?? null,
          pageTitle: (nid) => targets.get(nid) ?? null,
          report: (e) => {
            explained = true
            if (e.kind === 'file-failed') report.failedFiles.push({ page: title, url: e.detail })
            else if (e.kind === 'unsupported') report.unsupported.push({ page: title, type: e.detail })
            else report.notes.push(`${title}: sütun düzeni alt alta dizildi`)
          }
        }
        const content = convertBlocks(info.blocks, ctx)
        const doc: JSONContent = { type: 'doc', content }
        const n = countBlocks(info.blocks)
        const k = countDocBlocks(doc)
        if (n !== k && !explained) report.mismatches.push({ page: title, notion: n, kernel: k })
        const current = await vault.read(kernelId)
        await vault.write(kernelId, { markdown: docToMarkdown(doc), meta: { ...current.meta, ...pageMeta(info.page, ctx) } })
        state.done.push(info.notionId)
        await this.saveState(state)
        report.pages++
        onProgress({ phase: 'importing', pagesDone: state.done.length, pagesTotal: infos.length, current: title })
      }

      // 4) rapor
      report.files = this.files.size
      await this.writeReport(state.rootKernelId, report)
      await rm(this.stateFile, { force: true })
      onProgress({ phase: 'done', pagesDone: infos.length, pagesTotal: infos.length, report })
      return report
    } catch (e) {
      onProgress({ phase: 'error', pagesDone: state.done.length, pagesTotal: infos.length, error: e instanceof Error ? e.message : 'Aktarım hatası' })
      throw e
    }
  }

  private exists(kernelId: string): boolean {
    try {
      this.deps.vault.pathOf(kernelId)
      return true
    } catch {
      return false
    }
  }

  /** Notion kimliği → wiki hedefi: başlık benzersizse başlık, değilse kasa içi yol */
  private async wikiTargets(state: ImportState, infos: PageInfo[]): Promise<Map<string, string>> {
    const all = new Map<string, number>()
    const collect = (nodes: Awaited<ReturnType<Vault['tree']>>) => nodes.forEach((n) => (all.set(foldKey(n.title), (all.get(foldKey(n.title)) ?? 0) + 1), collect(n.children)))
    collect(await this.deps.vault.tree())
    const out = new Map<string, string>()
    for (const info of infos) {
      const page = await this.deps.vault.read(state.pages[info.notionId]!)
      out.set(info.notionId, (all.get(foldKey(page.title)) ?? 0) > 1 ? page.path.replace(/\.md$/, '') : page.title)
    }
    return out
  }

  private async writeReport(rootId: string, r: ImportReport): Promise<void> {
    const { vault } = this.deps
    const summary = [
      `Notion'dan **${r.pages}** sayfa ve **${r.files}** dosya aktarıldı.`,
      '',
      r.failedFiles.length || r.unsupported.length || r.mismatches.length ? 'Bazı içerikler tam aktarılamadı; ayrıntılar [[Notion aktarım raporu]] sayfasında.' : 'Tüm içerik sorunsuz aktarıldı.'
    ].join('\n')
    const root = await vault.read(rootId)
    await vault.write(rootId, { markdown: `${summary}\n`, meta: { ...root.meta, icon: root.meta.icon ?? '📥' } })
    const lines = ['## Özet', '', `- Sayfa: ${r.pages}`, `- Dosya: ${r.files}`, `- İndirilemeyen dosya: ${r.failedFiles.length}`, `- Desteklenmeyen blok: ${r.unsupported.length}`, '']
    if (r.failedFiles.length) lines.push('## İndirilemeyen dosyalar', '', ...r.failedFiles.map((f) => `- ${f.page}: ${f.url}`), '')
    if (r.unsupported.length) lines.push('## Desteklenmeyen bloklar', '', ...r.unsupported.map((u) => `- ${u.page}: \`${u.type}\``), '')
    if (r.mismatches.length) lines.push('## Blok sayısı farkları', '', ...r.mismatches.map((m) => `- ${m.page}: Notion ${m.notion}, Kernel ${m.kernel}`), '')
    if (r.notes.length) lines.push('## Notlar', '', ...[...new Set(r.notes)].map((n) => `- ${n}`), '')
    const rep = await vault.create(rootId, 'Notion aktarım raporu')
    const repPage = await vault.read(rep.id)
    await vault.write(rep.id, { markdown: lines.join('\n'), meta: { ...repPage.meta, icon: '🧾' } })
  }
}
