import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PageMeta } from '@shared/types'
import { stringify } from 'yaml'
import { splitFrontmatter } from './vault/frontmatter'
import { sanitizeTitle, uniqueName } from './vault/names'
import { writeAtomic } from './vault/atomic'
import type { Lang } from '@shared/types'
import { localeOf, t } from '@shared/i18n'

export const formatDateTr = (d: Date): string => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

/** Şablon tarihi: dilin kısa biçimi (tr/de GG.AA.YYYY, en AA/GG/YYYY) */
export const formatTemplateDate = (d: Date, lang: Lang): string => new Intl.DateTimeFormat(localeOf(lang), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d)

// her dilin şablon değişkenleri: başlık ve tarih
const TITLE_VARS = ['{{başlık}}', '{{title}}', '{{Titel}}']
const DATE_VARS = ['{{tarih}}', '{{date}}', '{{Datum}}']

// Sayfa şablonları: .kernel/templates/<ad>.md
export class TemplateStore {
  private readonly dir: string

  constructor(
    root: string,
    private readonly now: () => Date = () => new Date(),
    /** varsayılan şablonun ve tarih biçiminin dili */
    private readonly lang: Lang = 'tr'
  ) {
    this.dir = join(root, '.kernel', 'templates')
  }

  async list(): Promise<string[]> {
    try {
      return (await readdir(this.dir))
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.slice(0, -3).normalize('NFC'))
        .sort((a, b) => a.localeCompare(b, 'tr'))
    } catch {
      return []
    }
  }

  async ensureDefault(): Promise<void> {
    if ((await this.list()).length) return
    await mkdir(this.dir, { recursive: true })
    await writeAtomic(join(this.dir, `${t(this.lang, 'template.defaultName')}.md`), t(this.lang, 'template.defaultBody'))
  }

  /** Şablonu doldurur: tarih ve başlık değişkenleri (üç dilde); ikon/kapak meta'sı kopyalanır */
  async render(name: string, title: string): Promise<{ markdown: string; meta: Partial<PageMeta> }> {
    const text = await readFile(join(this.dir, `${sanitizeTitle(name)}.md`), 'utf8')
    const { meta, body } = splitFrontmatter(text)
    const date = formatTemplateDate(this.now(), this.lang)
    let markdown = body
    for (const v of DATE_VARS) markdown = markdown.replaceAll(v, date)
    for (const v of TITLE_VARS) markdown = markdown.replaceAll(v, title)
    const out: Partial<PageMeta> = {}
    if (typeof meta['icon'] === 'string') out.icon = meta['icon']
    if (typeof meta['cover'] === 'string') out.cover = meta['cover']
    return { markdown, meta: out }
  }

  async saveFrom(markdown: string, meta: PageMeta, name: string): Promise<string> {
    await mkdir(this.dir, { recursive: true })
    const base = await uniqueName(this.dir, sanitizeTitle(name), '.md')
    // şablon yalnızca görünüm meta'sını (ikon, kapak) taşır; kimlik ve tarihler yeni sayfada üretilir
    const keep: Record<string, string> = {}
    if (meta.icon) keep['icon'] = meta.icon
    if (meta.cover) keep['cover'] = meta.cover
    const text = Object.keys(keep).length ? `---\n${stringify(keep)}---\n${markdown}` : markdown
    await writeAtomic(join(this.dir, `${base}.md`), text)
    return base
  }
}
