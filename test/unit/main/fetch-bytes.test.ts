import { describe, expect, it, vi } from 'vitest'
import { fetchBytes, readBodyLimited } from '../../../src/main/fetch-bytes'

describe('readBodyLimited & fetchBytes', () => {
  it('Content-Length olmadan akış sınırı aşılırsa okuyucuyu iptal edip null döner', async () => {
    let canceled = false
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(ctrl) {
        pulled++
        ctrl.enqueue(new Uint8Array(60).fill(pulled))
      },
      cancel() {
        canceled = true
      }
    })
    const res = new Response(stream, { status: 200, headers: { 'content-type': 'image/png' } })
    const out = await readBodyLimited(res, 100)
    expect(out).toBeNull()
    expect(canceled).toBe(true)
    expect(pulled).toBeLessThanOrEqual(2)
  })

  it('Content-Length sınırı aşıyorsa gövde okunmadan null döner', async () => {
    let pulled = false
    const stream = new ReadableStream<Uint8Array>({
      pull() {
        pulled = true
      }
    })
    const res = new Response(stream, { status: 200, headers: { 'content-length': '2000', 'content-type': 'image/png' } })
    expect(await readBodyLimited(res, 100)).toBeNull()
    expect(pulled).toBe(false)
  })

  it('sınır içindeki parçalı yanıtı eksiksiz döndürür', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(new Uint8Array([1, 2, 3]))
        ctrl.enqueue(new Uint8Array([4, 5]))
        ctrl.close()
      }
    })
    const fetchImpl = vi.fn(async () => new Response(stream, { status: 200, headers: { 'content-type': 'image/png; charset=utf-8' } }))
    const res = await fetchBytes('https://ornek.example/g.png', { maxBytes: 10, timeoutMs: 1000, fetchImpl, checkType: (ct) => ct.startsWith('image/') })
    expect(res).toEqual({ bytes: new Uint8Array([1, 2, 3, 4, 5]), contentType: 'image/png' })
  })

  it('zaman aşımında AbortSignal ile kesilip null döner', async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'TimeoutError')))
      })
    const res = await fetchBytes('https://ornek.example/yavas.png', { maxBytes: 1024, timeoutMs: 30, fetchImpl })
    expect(res).toBeNull()
  })
})
