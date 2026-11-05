import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchLatestRelease, LATEST_URL } from '../../../src/main/updates'

const body = {
  tag_name: 'v9.0.0',
  html_url: 'https://github.com/serhandenizhan/kernel/releases/tag/v9.0.0',
  body: '',
  assets: []
}

describe('fetchLatestRelease', () => {
  it('reads the GitHub api and parses the release', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
    const info = await fetchLatestRelease({ fetchImpl, platform: 'darwin', env: {} })
    expect(fetchImpl).toHaveBeenCalledWith(LATEST_URL, expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/vnd.github+json' }) }))
    expect(info?.version).toBe('9.0.0')
  })

  it('returns null on network errors and non-200 answers', async () => {
    expect(await fetchLatestRelease({ fetchImpl: async () => Promise.reject(new Error('offline')), platform: 'darwin', env: {} })).toBeNull()
    expect(await fetchLatestRelease({ fetchImpl: async () => new Response('x', { status: 403 }), platform: 'darwin', env: {} })).toBeNull()
  })

  it('never touches the network under tests unless a feed file is given', async () => {
    const fetchImpl = vi.fn()
    expect(await fetchLatestRelease({ fetchImpl, platform: 'darwin', env: { KERNEL_TEST: '1' } })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
    const dir = mkdtempSync(join(tmpdir(), 'kernel-feed-'))
    const feed = join(dir, 'latest.json')
    writeFileSync(feed, JSON.stringify(body))
    const info = await fetchLatestRelease({ fetchImpl, platform: 'darwin', env: { KERNEL_TEST: '1', KERNEL_TEST_UPDATE_FEED: feed } })
    expect(info?.version).toBe('9.0.0')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
