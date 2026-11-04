import { useEffect, useMemo, useRef, useState } from 'react'
import { normalizeTr } from '@core/normalize-tr'
import { EMOJI_TR } from '../assets/emoji-tr'
import { kernel } from '../lib/kernel'

interface Emoji {
  unicode: string
  label: string
  tags?: string[]
  group?: number
}

let cache: Emoji[] | null = null
async function loadEmoji(): Promise<Emoji[]> {
  if (!cache) {
    const data = (await import('emojibase-data/en/compact.json')).default as Emoji[]
    cache = data.filter((e) => e.group !== 2) // ten tonu bileşenleri hariç
  }
  return cache
}

const POPULAR = Object.keys(EMOJI_TR)

// Sayfa ikonu seçici: emoji (Türkçe/İngilizce arama), kendi görselin, kaldır
export function IconPicker({ anchor, onPick, onRemove, onClose }: { anchor: DOMRect; onPick(icon: string): void; onRemove(): void; onClose(): void }) {
  const [query, setQuery] = useState('')
  const [all, setAll] = useState<Emoji[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void loadEmoji().then(setAll)
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [onClose])

  const results = useMemo(() => {
    const q = normalizeTr(query.trim())
    if (!q) return POPULAR.concat(all.slice(0, 160).map((e) => e.unicode).filter((u) => !POPULAR.includes(u)))
    const tr = POPULAR.filter((u) => normalizeTr(EMOJI_TR[u]!).includes(q))
    const en = all.filter((e) => normalizeTr(e.label).includes(q) || e.tags?.some((t) => normalizeTr(t).includes(q))).map((e) => e.unicode)
    return [...new Set([...tr, ...en])].slice(0, 200)
  }, [query, all])

  return (
    <div ref={ref} className="icon-picker glass" style={{ left: anchor.left, top: anchor.bottom + 6 }}>
      <div className="picker-head">
        <input className="picker-search" data-testid="icon-search" autoFocus placeholder="Emoji ara (ör. kitap, beyin, atom)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className="btn small" onClick={() => fileRef.current?.click()}>
          Görsel yükle
        </button>
        <button className="btn small" data-testid="icon-remove" onClick={onRemove}>
          Kaldır
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const src = await kernel.attachments.save(new Uint8Array(await f.arrayBuffer()), f.name.split('.').pop() ?? 'png', 'icon')
            onPick(src)
          }}
        />
      </div>
      <div className="emoji-grid">
        {results.map((u) => (
          <button key={u} className="emoji-option" data-testid="emoji-option" onClick={() => onPick(u)}>
            {u}
          </button>
        ))}
        {!results.length && <div className="picker-empty">Sonuç yok</div>}
      </div>
    </div>
  )
}
