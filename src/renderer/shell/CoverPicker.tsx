import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { COVER_PRESETS } from '../assets/covers'
import { kernel } from '../lib/kernel'
import { tNow } from '../lib/i18n'

// Kapak seçici: hazır Kernel kapakları ya da kendi görselin
export function CoverPicker({ anchor, onPick, onClose }: { anchor: DOMRect; onPick(cover: string): void; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])

  // body'ye çizilir: sayfa yüzeyinin cam efekti (backdrop-filter) sabit konumlu menüleri kaydırmasın
  return createPortal(
    <div ref={ref} className="cover-picker glass" style={{ left: Math.max(8, anchor.right - 420), top: anchor.bottom + 6 }}>
      <div className="picker-title">{tNow('cover.presets')}</div>
      <div className="cover-grid">
        {COVER_PRESETS.map((p) => (
          <button key={p.id} className="cover-option" data-testid={`cover-preset-${p.id}`} title={tNow(p.label)} style={{ background: p.css }} onClick={() => onPick(p.id)} />
        ))}
      </div>
      <label className="btn small upload-btn">
        {tNow('cover.upload')}
        <input
          type="file"
          accept="image/*"
          hidden
          data-testid="cover-upload"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const ext = f.name.split('.').pop()?.toLowerCase() ?? 'png'
            const src = await kernel.attachments.save(new Uint8Array(await f.arrayBuffer()), ext, f.name.replace(/\.[^.]+$/, '') || 'kapak')
            onPick(src)
          }}
        />
      </label>
    </div>,
    document.body
  )
}
