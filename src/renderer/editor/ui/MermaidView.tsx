import { useEffect, useId, useState } from 'react'
import { renderMermaid } from '../../lib/mermaid'

// Mermaid önizlemesi: kod değiştikçe (300 ms sonra) yeniden çizilir; hatalı kodda hata metni
export function MermaidPreview({ code }: { code: string }) {
  const rid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [state, setState] = useState<{ svg?: string; error?: string }>({})

  useEffect(() => {
    let alive = true
    const t = setTimeout(async () => {
      if (!code.trim()) return setState({})
      const res = await renderMermaid(code, `m${rid}${Date.now()}`)
      if (alive) setState(res)
    }, 300)
    // baskı görünümü: zamanlayıcı da bekleyen render sayılır (render başlayınca kendi sayacını artırır)
    window.kernelPendingRenders = (window.kernelPendingRenders ?? 0) + 1
    let released = false
    const releaseOnce = () => {
      if (released) return
      released = true
      window.kernelPendingRenders = Math.max(0, (window.kernelPendingRenders ?? 1) - 1)
    }
    const release = setTimeout(releaseOnce, 320)
    return () => {
      alive = false
      clearTimeout(t)
      clearTimeout(release)
      releaseOnce()
    }
  }, [code, rid])

  if (state.error) return <div className="mermaid-error">Diyagram hatası: {state.error}</div>
  return <div className="mermaid-preview" contentEditable={false} dangerouslySetInnerHTML={{ __html: state.svg ?? '' }} />
}
