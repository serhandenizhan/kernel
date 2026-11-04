import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { resolveVaultUrl, VAULT_SCHEME } from './protocol'
import { state } from './state'

// app.ready öncesi çağrılmalı
export function registerVaultScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: VAULT_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }])
}

export function handleVaultProtocol(): void {
  protocol.handle(VAULT_SCHEME, async (req) => {
    const root = state.vault?.root
    const abs = root ? resolveVaultUrl(root, req.url) : null
    if (!abs) return new Response('Bulunamadı', { status: 404 })
    // yalnızca uygulamanın kendi sayfaları bu şemaya erişebilir; fetch (PDF görüntüleyici) için CORS başlığı
    const res = await net.fetch(pathToFileURL(abs).toString())
    const headers = new Headers(res.headers)
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(res.body, { status: res.status, headers })
  })
}
