import { tNow } from './i18n'
// Mermaid tembel yüklenir (büyük kütüphane); yalnızca diyagram olan sayfalarda indirilir
type MermaidApi = typeof import('mermaid').default

let api: Promise<MermaidApi> | null = null
let currentTheme: 'default' | 'dark' | null = null

declare global {
  interface Window {
    /** PDF görünümü: bitmemiş asenkron render sayısı (0 olunca baskıya hazır) */
    kernelPendingRenders?: number
  }
}

function load(): Promise<MermaidApi> {
  api ??= import('mermaid').then((m) => m.default)
  return api
}

export async function renderMermaid(code: string, id: string): Promise<{ svg: string } | { error: string }> {
  window.kernelPendingRenders = (window.kernelPendingRenders ?? 0) + 1
  try {
    const mermaid = await load()
    const theme = document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'default'
    if (theme !== currentTheme) {
      // htmlLabels kapalı: etiketler SVG metni olur (PDF'te vektörel ve seçilebilir)
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', flowchart: { htmlLabels: false }, htmlLabels: false } as never)
      currentTheme = theme
    }
    await mermaid.parse(code)
    const { svg } = await mermaid.render(id, code)
    return { svg }
  } catch (e) {
    document.getElementById(`d${id}`)?.remove()
    return { error: e instanceof Error ? e.message.split('\n')[0]! : tNow('diagram.failed') }
  } finally {
    window.kernelPendingRenders = Math.max(0, (window.kernelPendingRenders ?? 1) - 1)
  }
}
