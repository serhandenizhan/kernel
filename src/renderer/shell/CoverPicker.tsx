import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { COVER_PRESETS } from '../assets/covers'
import { kernel } from '../lib/kernel'
import { tNow, useT } from '../lib/i18n'
import type { MessageKey } from '@shared/i18n'
import type { UnsplashThumb } from '@shared/types'

export interface CoverCredit {
  credit: string
  creditUrl: string
}

type UnsplashError = 'no-key' | 'invalid-key' | 'rate-limit' | 'network'
const ERROR_KEY: Record<UnsplashError, MessageKey> = {
  'no-key': 'cover.unsplash.intro',
  'invalid-key': 'cover.unsplash.err.invalid',
  'rate-limit': 'cover.unsplash.err.rate',
  network: 'cover.unsplash.err.network'
}
// hızlı aramalar: etiket çevrilir, arama sözcüğü İngilizce (Unsplash'te en çok sonuç verir)
const QUICK: { q: string; label: MessageKey }[] = [
  { q: 'nature', label: 'cover.unsplash.q.nature' },
  { q: 'abstract', label: 'cover.unsplash.q.abstract' },
  { q: 'city', label: 'cover.unsplash.q.city' },
  { q: 'sky', label: 'cover.unsplash.q.sky' },
  { q: 'texture', label: 'cover.unsplash.q.texture' },
  { q: 'minimal', label: 'cover.unsplash.q.minimal' }
]

// Kapak seçici: hazır kapaklar (galeri), Unsplash fotoğrafları ya da kendi görselin
export function CoverPicker({ anchor, onPick, onClose }: { anchor: DOMRect; onPick(cover: string, credit?: CoverCredit): void; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null)
  const t = useT()
  const [tab, setTab] = useState<'gallery' | 'unsplash'>('gallery')

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
    <div ref={ref} className="cover-picker glass" style={{ left: Math.max(8, anchor.right - 480), top: anchor.bottom + 6, maxHeight: `calc(100vh - ${anchor.bottom + 22}px)` }}>
      <div className="picker-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'gallery'} className={`picker-tab${tab === 'gallery' ? ' on' : ''}`} data-testid="cover-tab-gallery" onClick={() => setTab('gallery')}>
          {t('cover.tabGallery')}
        </button>
        <button role="tab" aria-selected={tab === 'unsplash'} className={`picker-tab${tab === 'unsplash' ? ' on' : ''}`} data-testid="cover-tab-unsplash" onClick={() => setTab('unsplash')}>
          {t('cover.tabUnsplash')}
        </button>
        <span className="spacer" />
        <label className="btn small upload-btn">
          {t('cover.upload')}
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
      </div>
      {tab === 'gallery' ? (
        <div className="cover-grid">
          {COVER_PRESETS.map((p) => (
            <button key={p.id} className="cover-option" data-testid={`cover-preset-${p.id}`} title={tNow(p.label)} aria-label={tNow(p.label)} style={{ background: p.css }} onClick={() => onPick(p.id)} />
          ))}
        </div>
      ) : (
        <UnsplashTab onPick={onPick} />
      )}
    </div>,
    document.body
  )
}

function UnsplashTab({ onPick }: { onPick(cover: string, credit?: CoverCredit): void }) {
  const t = useT()
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [editKey, setEditKey] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const [query, setQuery] = useState('')
  const [photos, setPhotos] = useState<UnsplashThumb[]>([])
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(0)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState<string | null>(null)
  const [error, setError] = useState<MessageKey | null>(null)

  useEffect(() => {
    void kernel.unsplash.status().then((s) => setHasKey(s.hasKey))
  }, [])

  const search = async (q: string, nextPage: number) => {
    if (!q.trim()) return
    setBusy(true)
    setError(null)
    const r = await kernel.unsplash.search(q, nextPage).catch(() => ({ ok: false as const, error: 'network' as const }))
    setBusy(false)
    if (!r.ok) {
      if (r.error === 'no-key') setHasKey(false)
      else setError(ERROR_KEY[r.error])
      return
    }
    setPhotos((prev) => (nextPage <= 1 ? r.photos : [...prev, ...r.photos]))
    setPage(nextPage)
    setPages(r.totalPages)
  }

  const pick = async (p: UnsplashThumb) => {
    setPicking(p.id)
    setError(null)
    try {
      const r = await kernel.unsplash.pick(p.id)
      onPick(r.src, { credit: r.credit, creditUrl: r.creditUrl })
    } catch {
      setPicking(null)
      setError('cover.unsplash.err.pick')
    }
  }

  if (hasKey === null) return <div className="unsplash-note">{t('cover.unsplash.searching')}</div>

  if (!hasKey || editKey) {
    return (
      <div className="unsplash-key" data-testid="unsplash-key-form">
        <p>{t('cover.unsplash.intro')}</p>
        <div className="unsplash-key-row">
          <input data-testid="unsplash-key-input" className="picker-search" spellCheck={false} placeholder={t('cover.unsplash.keyPlaceholder')} value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
          <button
            className="btn small primary"
            data-testid="unsplash-key-save"
            disabled={!keyDraft.trim()}
            onClick={async () => {
              await kernel.unsplash.setKey(keyDraft)
              setKeyDraft('')
              setHasKey(true)
              setEditKey(false)
              setError(null)
            }}
          >
            {t('cover.unsplash.saveKey')}
          </button>
        </div>
        <button className="link-btn" onClick={() => void kernel.unsplash.open('https://unsplash.com/oauth/applications/new')}>
          {t('cover.unsplash.getKey')}
        </button>
        <p className="unsplash-hint">{t('cover.unsplash.keyHint')}</p>
      </div>
    )
  }

  return (
    <div className="unsplash-tab">
      <input
        data-testid="unsplash-search"
        className="picker-search"
        placeholder={t('cover.unsplash.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void search(query, 1)
        }}
      />
      {photos.length === 0 && !busy && !error && (
        <div className="unsplash-chips">
          {QUICK.map((c) => (
            <button
              key={c.q}
              className="chip"
              onClick={() => {
                setQuery(c.q)
                void search(c.q, 1)
              }}
            >
              {t(c.label)}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="unsplash-error" data-testid="unsplash-error" role="alert">
          {t(error)}
          {error === 'cover.unsplash.err.invalid' && (
            <button className="link-btn" onClick={() => setEditKey(true)}>
              {t('cover.unsplash.changeKey')}
            </button>
          )}
        </div>
      )}
      {busy && photos.length === 0 && <div className="unsplash-note">{t('cover.unsplash.searching')}</div>}
      {photos.length > 0 && (
        <div className="unsplash-grid">
          {photos.map((p) => (
            <button key={p.id} className="unsplash-photo" data-testid="unsplash-result" title={p.author} aria-label={`${p.alt || p.author} · ${p.author}`} disabled={picking !== null} onClick={() => void pick(p)}>
              {p.thumb ? <img src={p.thumb} alt="" draggable={false} /> : null}
              <span className="unsplash-author">{p.author}</span>
              {picking === p.id && <span className="unsplash-picking">{t('cover.unsplash.picking')}</span>}
            </button>
          ))}
        </div>
      )}
      {photos.length > 0 && pages > page && (
        <button className="btn small" disabled={busy} onClick={() => void search(query, page + 1)}>
          {busy ? t('cover.unsplash.searching') : t('cover.unsplash.more')}
        </button>
      )}
      {photos.length === 0 && !busy && !error && page > 0 && <div className="unsplash-note">{t('cover.unsplash.empty')}</div>}
      <button className="link-btn unsplash-change" onClick={() => setEditKey(true)}>
        {t('cover.unsplash.changeKey')}
      </button>
    </div>
  )
}
