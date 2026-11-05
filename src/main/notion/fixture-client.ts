import type { NotionBlock, NotionList, NotionPage, NotionRichText } from '@core/notion/types'
import { NotionError, type NotionClient } from './client'
import { mainT } from '../i18n'

export type NotionApi = Pick<NotionClient, 'me' | 'search' | 'page' | 'children' | 'queryDatabase' | 'database'>

export interface FixtureData {
  workspace: string
  pages: NotionPage[]
  /** sayfa kimliği → üst seviye bloklar (iç içe çocuklar `children` alanında) */
  blocks: Record<string, NotionBlock[]>
  databases?: Record<string, { title: NotionRichText[]; properties: Record<string, { type: string }>; rows: NotionPage[] }>
}

// Testler ve sihirbaz e2e'si için: gerçek API yerine SENTETİK veriden yanıt veren istemci
export class FixtureNotionClient implements NotionApi {
  private byId = new Map<string, NotionBlock>()
  /** Test kancası: 'network' | 'not_found' | true dönerse o çağrı NotionError fırlatır */
  failOn: ((op: string, id: string) => boolean | 'network' | 'not_found') | null = null

  constructor(private readonly data: FixtureData) {
    const index = (blocks: NotionBlock[]) => blocks.forEach((b) => (this.byId.set(b.id, b), index(b.children ?? [])))
    Object.values(data.blocks).forEach(index)
  }

  private check(op: string, id: string): void {
    const f = this.failOn?.(op, id)
    if (!f) return
    if (f === 'network') throw new NotionError(mainT('notionErr.network'), 0, 'network')
    if (f === 'not_found') throw new NotionError(mainT('notionErr.notFound'), 404, 'object_not_found')
    throw new NotionError(mainT('notionErr.status', { status: 503 }), 503, 'service_unavailable')
  }

  async me(): Promise<{ workspaceName: string }> {
    return { workspaceName: this.data.workspace }
  }

  async search(): Promise<NotionList<NotionPage>> {
    return { results: this.data.pages, next_cursor: null }
  }

  async page(id: string): Promise<NotionPage> {
    this.check('page', id)
    const p = this.data.pages.find((x) => x.id === id)
    if (!p) throw new NotionError(mainT('notionErr.notFound'), 404, 'object_not_found')
    return p
  }

  async children(blockId: string): Promise<NotionList<NotionBlock>> {
    this.check('children', blockId)
    const list = this.data.blocks[blockId] ?? this.byId.get(blockId)?.children ?? []
    // gerçek API gibi: çocuklar ayrı istekle gelir
    return { results: list.map(({ children, ...rest }) => ({ ...rest, has_children: Boolean(children?.length) || rest.has_children })), next_cursor: null }
  }

  async queryDatabase(id: string): Promise<NotionList<NotionPage>> {
    return { results: this.data.databases?.[id]?.rows ?? [], next_cursor: null }
  }

  async database(id: string): Promise<{ title: NotionRichText[]; properties: Record<string, { type: string }> }> {
    const db = this.data.databases?.[id]
    if (!db) throw new NotionError(mainT('notionErr.notFound'), 404, 'object_not_found')
    return { title: db.title, properties: db.properties }
  }
}
