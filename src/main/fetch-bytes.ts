// Uzak dosya indirme yardımcısı: zaman aşımı ve akış sırasında bayt sınırı uygular (OOM koruması)
export async function readBodyLimited(res: Response, maxBytes: number): Promise<Uint8Array | null> {
  const clHeader = res.headers.get('content-length')
  if (clHeader !== null) {
    const cl = Number(clHeader)
    if (Number.isFinite(cl) && cl > maxBytes) {
      await res.body?.cancel().catch(() => undefined)
      return null
    }
  }
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer())
    return buf.byteLength > maxBytes ? null : buf
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

export async function fetchBytes(
  url: string,
  opts: {
    maxBytes: number
    timeoutMs: number
    fetchImpl?: typeof fetch
    checkType?: (contentType: string) => boolean
  }
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(opts.timeoutMs) })
    if (!res.ok) return null
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
    if (opts.checkType && !opts.checkType(contentType)) {
      await res.body?.cancel().catch(() => undefined)
      return null
    }
    const bytes = await readBodyLimited(res, opts.maxBytes)
    return bytes ? { bytes, contentType } : null
  } catch {
    return null
  }
}
