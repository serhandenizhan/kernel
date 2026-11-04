import { mkdir, readdir, readFile, rename, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { ulid } from 'ulid'
import type { PageData, PageMeta, TreeNode } from '@shared/types'
import { joinFrontmatter, splitFrontmatter } from './frontmatter'
import { sanitizeTitle, uniqueName } from './names'
import { writeAtomic } from './atomic'
import { loadOrder, saveOrder, type Order } from './order'

const ROOT_KEY = 'root'
const isHidden = (name: string) => name.startsWith('.')
const titleOf = (file: string) => basename(file, '.md').normalize('NFC')
const folderOf = (mdPath: string) => mdPath.slice(0, -3) // "X.md" → "X" (alt sayfa klasörü)
const key = (s: string) => s.normalize('NFC').toLocaleLowerCase('tr')

interface Cached {
  id: string
  icon?: string
  mtimeMs: number
}

// Kasa: düz Markdown dosyaları. X.md'nin alt sayfaları kardeş X/ klasöründedir.
export class Vault {
  readonly root: string
  private byId = new Map<string, string>() // id → mutlak yol
  private cache = new Map<string, Cached>() // mutlak yol → meta önbelleği
  /** Kendi yazımlarımız: watcher bunları yok sayar (mutlak yol → yazım sonrası mtimeMs) */
  readonly recentWrites = new Map<string, number>()

  constructor(root: string) {
    this.root = root
  }

  async init(): Promise<void> {
    await mkdir(join(this.root, '.kernel'), { recursive: true })
    await mkdir(join(this.root, 'attachments'), { recursive: true })
    await this.reindex()
  }

  /** Tüm .md dosyalarını tarar; id'si olmayan ya da yinelenen dosyalara yeni id yazar */
  async reindex(): Promise<void> {
    this.byId.clear()
    for (const file of await this.allPages(this.root)) {
      const meta = await this.metaOf(file)
      if (!meta.id || this.byId.has(meta.id)) {
        await this.assignId(file)
      } else {
        this.byId.set(meta.id, file)
      }
    }
  }

  private async allPages(dir: string): Promise<string[]> {
    const out: string[] = []
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return out
    }
    for (const e of entries) {
      if (isHidden(e.name)) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        if (dir === this.root && e.name === 'attachments') continue
        out.push(...(await this.allPages(p)))
      } else if (e.name.endsWith('.md')) {
        out.push(p)
      }
    }
    return out
  }

  private async metaOf(file: string): Promise<Partial<Cached>> {
    const st = await stat(file)
    const c = this.cache.get(file)
    if (c && c.mtimeMs === st.mtimeMs) return c
    const { meta } = splitFrontmatter(await readFile(file, 'utf8'))
    const entry: Cached = { id: typeof meta['id'] === 'string' ? meta['id'] : '', icon: typeof meta['icon'] === 'string' ? meta['icon'] : undefined, mtimeMs: st.mtimeMs }
    this.cache.set(file, entry)
    return entry
  }

  private async assignId(file: string): Promise<void> {
    const text = await readFile(file, 'utf8')
    const { meta, body } = splitFrontmatter(text)
    const st = await stat(file)
    const full = this.normalizeMeta(meta, st)
    full.id = ulid()
    await this.writeFile(file, joinFrontmatter(full, body))
    this.byId.set(full.id, file)
  }

  private normalizeMeta(meta: Record<string, unknown>, st: { birthtime: Date; mtime: Date }): PageMeta {
    const str = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string) : undefined)
    const out: PageMeta = {
      id: str('id') ?? '',
      created: str('created') ?? st.birthtime.toISOString(),
      updated: str('updated') ?? st.mtime.toISOString()
    }
    if (str('icon')) out.icon = str('icon')
    if (str('cover')) out.cover = str('cover')
    if (typeof meta['coverPosition'] === 'number') out.coverPosition = meta['coverPosition'] as number
    if (Array.isArray(meta['tags'])) out.tags = (meta['tags'] as unknown[]).map(String)
    return out
  }

  private async writeFile(file: string, text: string): Promise<void> {
    await writeAtomic(file, text)
    this.cache.delete(file)
    // watcher kendi yazımımızı mtime eşleşmesiyle tanır
    this.recentWrites.set(file, (await stat(file)).mtimeMs)
  }

  idOf(absPath: string): string | null {
    for (const [id, p] of this.byId) if (p === absPath) return id
    return null
  }

  pathOf(id: string): string {
    const p = this.byId.get(id)
    if (!p) throw new Error(`Sayfa bulunamadı: ${id}`)
    return p
  }

  private rel(abs: string): string {
    return relative(this.root, abs).split(sep).join('/')
  }

  private parentKey(abs: string): string {
    const dir = dirname(abs)
    if (dir === this.root) return ROOT_KEY
    const parentMd = `${dir}.md`
    for (const [id, p] of this.byId) if (p === parentMd) return id
    return ROOT_KEY
  }

  private dirForChildren(parentId: string | null): string {
    return parentId ? folderOf(this.pathOf(parentId)) : this.root
  }

  async tree(): Promise<TreeNode[]> {
    const order = await loadOrder(this.root)
    return this.buildLevel(this.root, ROOT_KEY, order)
  }

  private async buildLevel(dir: string, parentKey: string, order: Order): Promise<TreeNode[]> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return []
    }
    const nodes: TreeNode[] = []
    for (const e of entries) {
      if (isHidden(e.name) || !e.isFile() || !e.name.endsWith('.md')) continue
      const abs = join(dir, e.name)
      const meta = await this.metaOf(abs)
      let id = meta.id ?? ''
      if (!id || this.byId.get(id) !== abs) {
        // dışarıdan eklenmiş dosya: yeniden indeksle
        await this.reindex()
        id = (await this.metaOf(abs)).id ?? ''
      }
      const node: TreeNode = { id, title: titleOf(e.name), path: this.rel(abs), children: [] }
      if (meta.icon) node.icon = meta.icon
      const sub = folderOf(abs)
      if (existsSync(sub)) node.children = await this.buildLevel(sub, id, order)
      nodes.push(node)
    }
    const list = order[parentKey] ?? []
    const rank = (id: string) => {
      const i = list.indexOf(id)
      return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }
    return nodes.sort((a, b) => rank(a.id) - rank(b.id) || a.title.localeCompare(b.title, 'tr'))
  }

  async read(id: string): Promise<PageData> {
    const abs = this.pathOf(id)
    const text = await readFile(abs, 'utf8')
    const { meta, body } = splitFrontmatter(text)
    const full = this.normalizeMeta(meta, await stat(abs))
    full.id = id
    return { id, title: titleOf(abs), path: this.rel(abs), meta: full, markdown: body }
  }

  async write(id: string, input: { markdown: string; meta: PageMeta }): Promise<{ updated: string }> {
    const abs = this.pathOf(id)
    const updated = new Date().toISOString()
    await this.writeFile(abs, joinFrontmatter({ ...input.meta, id, updated }, input.markdown))
    return { updated }
  }

  async create(parentId: string | null, title?: string): Promise<TreeNode> {
    const dir = this.dirForChildren(parentId)
    await mkdir(dir, { recursive: true })
    const name = await uniqueName(dir, sanitizeTitle(title ?? ''), '.md')
    const abs = join(dir, `${name}.md`)
    const now = new Date().toISOString()
    const id = ulid()
    await this.writeFile(abs, joinFrontmatter({ id, created: now, updated: now }, ''))
    this.byId.set(id, abs)
    const order = await loadOrder(this.root)
    const k = parentId ?? ROOT_KEY
    order[k] = [...(order[k] ?? []).filter((x) => x !== id), id]
    await saveOrder(this.root, order)
    return { id, title: name, path: this.rel(abs), children: [] }
  }

  /** .md dosyasını ve varsa alt sayfa klasörünü birlikte taşır */
  private async relocate(id: string, targetDir: string, desiredTitle: string): Promise<string> {
    const abs = this.pathOf(id)
    const sameDir = dirname(abs) === targetDir
    let name: string
    if (sameDir && key(desiredTitle) === key(titleOf(abs))) {
      name = desiredTitle // yalnızca büyük/küçük harf değişimi ya da aynı ad
    } else {
      name = await uniqueName(targetDir, desiredTitle, '.md')
    }
    const nextAbs = join(targetDir, `${name}.md`)
    if (nextAbs === abs) return abs
    await mkdir(targetDir, { recursive: true })
    await rename(abs, nextAbs)
    const oldFolder = folderOf(abs)
    if (existsSync(oldFolder)) await rename(oldFolder, folderOf(nextAbs))
    this.cache.clear()
    await this.reindex()
    return nextAbs
  }

  async rename(id: string, title: string): Promise<TreeNode> {
    const abs = this.pathOf(id)
    const nextAbs = await this.relocate(id, dirname(abs), sanitizeTitle(title))
    const meta = await this.metaOf(nextAbs)
    const node: TreeNode = { id, title: titleOf(nextAbs), path: this.rel(nextAbs), children: [] }
    if (meta.icon) node.icon = meta.icon
    return node
  }

  async move(id: string, parentId: string | null, index: number): Promise<void> {
    const abs = this.pathOf(id)
    if (parentId) {
      const target = this.pathOf(parentId)
      if (target === abs || target.startsWith(folderOf(abs) + sep)) throw new Error('Sayfa kendi alt sayfasına taşınamaz')
    }
    const oldKey = this.parentKey(abs)
    await this.relocate(id, this.dirForChildren(parentId), titleOf(abs))
    const order = await loadOrder(this.root)
    order[oldKey] = (order[oldKey] ?? []).filter((x) => x !== id)
    const k = parentId ?? ROOT_KEY
    const list = (order[k] ?? []).filter((x) => x !== id)
    list.splice(Math.max(0, Math.min(index, list.length)), 0, id)
    order[k] = list
    await saveOrder(this.root, order)
  }

  async trash(id: string, trashFn: (absPath: string) => Promise<void>): Promise<void> {
    const abs = this.pathOf(id)
    const folder = folderOf(abs)
    await trashFn(abs)
    if (existsSync(folder)) await trashFn(folder)
    this.cache.clear()
    await this.reindex()
  }

  async saveAttachment(bytes: Uint8Array, ext: string, nameHint?: string): Promise<string> {
    const base = sanitizeTitle(nameHint ?? 'image').replace(/\s+$/, '')
    const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
    const name = `${base}-${randomBytes(4).toString('hex').slice(0, 6)}.${safeExt}`
    const abs = join(this.root, 'attachments', name)
    await mkdir(dirname(abs), { recursive: true })
    await writeAtomic(abs, bytes)
    return `attachments/${name}`
  }
}
