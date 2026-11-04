import type { NotionBlock, NotionList, NotionPage, NotionRichText } from '@core/notion/types'

const API = 'https://api.notion.com/v1'
const VERSION = '2022-06-28'
const WINDOW_MS = 1000
const MAX_PER_WINDOW = 3
const RETRY_STATUS = new Set([429, 500, 502, 503, 504])

export class NotionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message)
  }
}

interface Opts {
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  now?: () => number
  maxRetries?: number
}

// Notion API istemcisi: saniyede en fazla 3 istek, 429/5xx'te geri çekilmeli tekrar. Token yalnızca başlıkta.
export class NotionClient {
  private readonly f: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>
  private readonly now: () => number
  private readonly maxRetries: number
  private stamps: number[] = []

  constructor(
    private readonly token: string,
    opts: Opts = {}
  ) {
    this.f = opts.fetch ?? fetch
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.now = opts.now ?? Date.now
    this.maxRetries = opts.maxRetries ?? 5
  }

  private async throttle(): Promise<void> {
    let t = this.now()
    this.stamps = this.stamps.filter((s) => s > t - WINDOW_MS)
    if (this.stamps.length >= MAX_PER_WINDOW) {
      await this.sleep(WINDOW_MS - (t - this.stamps[0]!))
      t = this.now()
      this.stamps = this.stamps.filter((s) => s > t - WINDOW_MS)
    }
    this.stamps.push(t)
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle()
      let res: Response
      try {
        res = await this.f(`${API}${path}`, {
          method,
          headers: { Authorization: `Bearer ${this.token}`, 'Notion-Version': VERSION, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body)
        })
      } catch {
        if (attempt >= this.maxRetries) throw new NotionError('Notion’a bağlanılamadı (ağ hatası)', 0, 'network')
        await this.sleep(500 * 2 ** attempt)
        continue
      }
      if (res.ok) return (await res.json()) as T
      if (RETRY_STATUS.has(res.status) && attempt < this.maxRetries) {
        const after = Number(res.headers.get('Retry-After'))
        await this.sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 500 * 2 ** attempt)
        continue
      }
      let code = 'error'
      try {
        code = String(((await res.json()) as { code?: string }).code ?? 'error')
      } catch {
        // gövde JSON değil
      }
      // mesaj kullanıcıya gösterilebilir; Notion'ın gövdesi (token içerebilir) mesaja konmaz
      const msg = res.status === 401 ? 'Notion token’ı geçersiz' : res.status === 404 ? 'Notion sayfası bulunamadı ya da integration ile paylaşılmamış' : `Notion hatası (${res.status})`
      throw new NotionError(msg, res.status, code)
    }
  }

  async me(): Promise<{ workspaceName: string }> {
    const r = await this.request<{ bot?: { workspace_name?: string } }>('GET', '/users/me')
    return { workspaceName: r.bot?.workspace_name ?? 'Notion' }
  }

  search(cursor?: string): Promise<NotionList<NotionPage>> {
    return this.request('POST', '/search', { filter: { property: 'object', value: 'page' }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
  }

  page(id: string): Promise<NotionPage> {
    return this.request('GET', `/pages/${id}`)
  }

  children(blockId: string, cursor?: string): Promise<NotionList<NotionBlock>> {
    return this.request('GET', `/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`)
  }

  queryDatabase(id: string, cursor?: string): Promise<NotionList<NotionPage>> {
    return this.request('POST', `/databases/${id}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
  }

  database(id: string): Promise<{ title: NotionRichText[]; properties: Record<string, { type: string }> }> {
    return this.request('GET', `/databases/${id}`)
  }
}
