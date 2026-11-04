import { mkdir, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PageMeta } from '@shared/types'
import { stringify } from 'yaml'
import { splitFrontmatter } from './vault/frontmatter'
import { sanitizeTitle, uniqueName } from './vault/names'
import { writeAtomic } from './vault/atomic'

const DEFAULT_NAME = 'Ders notu'
const DEFAULT_BODY = `## Konu

{{başlık}} — {{tarih}}

## Önemli kavramlar

-

## Formüller

## Örnek sorular

1.

> [!tip] Sınav notu
>
> Hocanın vurguladığı noktaları buraya yaz.
`

export const formatDateTr = (d: Date): string => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

// Sayfa şablonları: .kernel/templates/<ad>.md
export class TemplateStore {
  private readonly dir: string

  constructor(
    root: string,
    private readonly now: () => Date = () => new Date()
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
    await writeAtomic(join(this.dir, `${DEFAULT_NAME}.md`), DEFAULT_BODY)
  }

  /** Şablonu doldurur: {{tarih}} → GG.AA.YYYY, {{başlık}} → sayfa başlığı; ikon/kapak meta'sı kopyalanır */
  async render(name: string, title: string): Promise<{ markdown: string; meta: Partial<PageMeta> }> {
    const text = await readFile(join(this.dir, `${sanitizeTitle(name)}.md`), 'utf8')
    const { meta, body } = splitFrontmatter(text)
    const markdown = body.replaceAll('{{tarih}}', formatDateTr(this.now())).replaceAll('{{başlık}}', title)
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
