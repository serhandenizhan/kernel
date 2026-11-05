import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NotionClient, NotionError } from '../../../src/main/notion/client'
import { saveToken, loadToken, clearToken, removeLegacyTokenFile } from '../../../src/main/secrets'

const TOKEN = 'secret_TEST_TOKEN_123'

function harness(responses: { status: number; body?: unknown; headers?: Record<string, string> }[]) {
  let clock = 0
  const sleeps: number[] = []
  const calls: { url: string; init: RequestInit }[] = []
  let i = 0
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const r = responses[Math.min(i++, responses.length - 1)]!
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: r.headers })
  }) as unknown as typeof fetch
  const client = new NotionClient(TOKEN, {
    fetch: fetchFn,
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms)
      clock += ms
    }
  })
  return { client, sleeps, calls }
}

describe('NotionClient', () => {
  it('saniyede en fazla 3 istek gönderir', async () => {
    const { client, sleeps } = harness([{ status: 200, body: { results: [], next_cursor: null } }])
    for (let k = 0; k < 7; k++) await client.children('b')
    expect(sleeps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(2000)
  })
  it('429 sonrası Retry-After kadar bekleyip tekrar dener', async () => {
    const { client, sleeps } = harness([{ status: 429, headers: { 'Retry-After': '2' } }, { status: 200, body: { results: [{ id: 'x' }], next_cursor: null } }])
    const res = await client.children('b')
    expect(res.results).toEqual([{ id: 'x' }])
    expect(sleeps).toContain(2000)
  })
  it('sürekli 503 → 6 denemeden sonra NotionError', async () => {
    const { client, calls } = harness([{ status: 503 }])
    await expect(client.children('b')).rejects.toBeInstanceOf(NotionError)
    expect(calls.length).toBe(6)
  })
  it('401 tekrar denenmez ve hata mesajı token içermez', async () => {
    const { client, calls } = harness([{ status: 401, body: { code: 'unauthorized', message: `API token is invalid: ${TOKEN}` } }])
    const err = (await client.me().catch((e: unknown) => e)) as NotionError
    expect(err).toBeInstanceOf(NotionError)
    expect(err.code).toBe('unauthorized')
    expect(err.message).not.toContain(TOKEN)
    expect(calls.length).toBe(1)
  })
  it('sayfalamada start_cursor gönderir, token yalnızca Authorization başlığında', async () => {
    const { client, calls } = harness([{ status: 200, body: { results: [], next_cursor: null } }])
    await client.children('blok-1', 'imlec-2')
    expect(calls[0]!.url).toBe('https://api.notion.com/v1/blocks/blok-1/children?page_size=100&start_cursor=imlec-2')
    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers['Authorization']).toBe(`Bearer ${TOKEN}`)
    expect(headers['Notion-Version']).toBe('2022-06-28')
    expect(calls[0]!.url).not.toContain(TOKEN)
  })
})

describe('secrets (yalnızca bellek)', () => {
  it('kaydet, oku, sil; hiçbir dosya yazılmaz', async () => {
    await saveToken(TOKEN)
    expect(await loadToken()).toBe(TOKEN)
    await clearToken()
    expect(await loadToken()).toBeNull()
  })
  it('eski sürümün şifreli token dosyası açılmadan silinir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kernel-sec-'))
    writeFileSync(join(dir, 'notion-token.bin'), Buffer.from([1, 2, 3]))
    await removeLegacyTokenFile(dir)
    expect(existsSync(join(dir, 'notion-token.bin'))).toBe(false)
  })
})
