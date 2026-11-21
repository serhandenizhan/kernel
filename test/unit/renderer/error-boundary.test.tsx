import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { ErrorBoundary, PageCrashFallback } from '../../../src/renderer/shell/ErrorBoundary'

describe('ErrorBoundary', () => {
  it('çökmeyen yedek ekranı uyarılı ve ana sayfaya dön düğmeli çizer', () => {
    const html = renderToStaticMarkup(
      <PageCrashFallback title="Bu sayfa açılamadı" actionLabel="Ana sayfaya dön" onHome={() => undefined} />
    )
    expect(html).toContain('data-testid="error-fallback"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Bu sayfa açılamadı')
    expect(html).toContain('data-testid="error-back-home"')
    expect(html).toContain('Ana sayfaya dön')
  })

  it('hata durumuna geçer ve resetKey değişince sıfırlanır', () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true })
    const eb = new ErrorBoundary({ fallback: 'yedek', resetKey: 'page::a', children: 'icerik' })
    eb.state = { failed: true }
    expect(eb.render()).toBe('yedek')
    const setState = vi.fn((next: { failed: boolean }) => {
      eb.state = next
    })
    eb.setState = setState as never
    ;(eb as unknown as { props: typeof eb.props }).props = { fallback: 'yedek', resetKey: 'page::b', children: 'icerik' }
    eb.componentDidUpdate({ resetKey: 'page::a' })
    expect(setState).toHaveBeenCalledWith({ failed: false })
    expect(eb.render()).toBe('icerik')
  })

  it('App.tsx hata sınırında currentId sıfırlama anahtarı ve statik yedek kullanır', () => {
    const src = readFileSync('src/renderer/App.tsx', 'utf8')
    expect(src).toMatch(/ErrorBoundary\s+resetKey=\{`\$\{view\}:\$\{overlay\}:\$\{currentId/)
    expect(src).not.toMatch(/fallback=\{<PageView\s*\/>\}/)
  })
})
