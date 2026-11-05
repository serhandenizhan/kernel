import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SUPPORTED_LANGUAGES, normalizeLanguage } from '@core/smart-paste/language'
import { tNow } from '../../lib/i18n'

const LABELS: Record<string, string> = {
  cpp: 'C++',
  csharp: 'C#',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  yaml: 'YAML',
  sql: 'SQL',
  php: 'PHP',
  r: 'R',
  c: 'C'
}
export const languageLabel = (l: string) => LABELS[l] ?? l.charAt(0).toUpperCase() + l.slice(1)

interface Option {
  value: string | null
  label: string
  hint?: string
}

// Seçenekler: düz metin, Mermaid diyagramı, ardından vurgulanan diller (alfabetik)
const OPTIONS: Option[] = [
  { value: null, get label() { return tNow('code.plain') } },
  { value: 'mermaid', label: 'Mermaid', get hint() { return tNow('code.diagram') } },
  ...[...SUPPORTED_LANGUAGES].sort((a, b) => languageLabel(a).localeCompare(languageLabel(b), 'tr')).map((l) => ({ value: l, label: languageLabel(l) }))
]

const fold = (s: string) => s.toLocaleLowerCase('tr').normalize('NFD').replace(/\p{M}/gu, '')

/** Aramaya göre sıralı seçenekler: tam eşleşme, sonra baştan eşleşme, sonra içeren; takma adlar (py, ts…) da bulunur */
function filterOptions(query: string): Option[] {
  const q = fold(query.trim())
  if (!q) return OPTIONS
  const alias = normalizeLanguage(query)
  const rank = (o: Option): number => {
    const names = [fold(o.label), o.value ?? 'duz metin']
    if (names.includes(q) || (alias && o.value === alias)) return 0
    if (names.some((n) => n.startsWith(q))) return 1
    if (names.some((n) => n.includes(q))) return 2
    return -1
  }
  return OPTIONS.map((o) => ({ o, r: rank(o) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r)
    .map((x) => x.o)
}

// Kod bloğu dil seçici: cam açılır panel, arama, klavye (↑ ↓ Enter Esc). Yazarken dil değişmez; yalnızca seçim uygulanır.
export function LanguagePicker({ value, disabled, onChange }: { value: string | null; disabled?: boolean; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const options = useMemo(() => filterOptions(query), [query])

  const close = () => {
    setOpen(false)
    setQuery('')
  }
  const choose = (o: Option | undefined) => {
    if (!o) return
    if (o.value !== value) onChange(o.value)
    close()
  }

  // paneli düğmenin altına (yer yoksa üstüne) yerleştir
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const r = buttonRef.current.getBoundingClientRect()
    const up = window.innerHeight - r.bottom < 320 && r.top > window.innerHeight - r.bottom
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: Math.min(r.left, window.innerWidth - 248), up })
  }, [open])

  useEffect(() => setActive(0), [query])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) close()
    }
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, options.length - 1))
    else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0))
    else if (e.key === 'Enter') choose(options[active])
    else if (e.key === 'Escape') {
      close()
      buttonRef.current?.focus()
    } else return
    e.preventDefault()
    e.stopPropagation()
  }

  const current = value ? (value === 'mermaid' ? 'Mermaid' : languageLabel(value)) : tNow('code.plain')

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`code-lang${open ? ' open' : ''}`}
        data-testid="code-language"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span>{current}</span>
        <svg className="code-lang-chevron" width="9" height="9" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            className={`lang-picker glass${pos.up ? ' up' : ''}`}
            style={{ top: pos.top, left: pos.left }}
            role="dialog"
            aria-label={tNow('code.language')}
            onKeyDown={onKey}
          >
            <input
              className="lang-search"
              data-testid="code-language-search"
              autoFocus
              placeholder={tNow('code.searchLanguage')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-controls="lang-picker-list"
              aria-activedescendant={`lang-opt-${active}`}
            />
            <div className="lang-list" id="lang-picker-list" role="listbox" ref={listRef}>
              {options.length === 0 && <div className="lang-empty">{tNow('code.noLanguage')}</div>}
              {options.map((o, i) => (
                <div
                  key={o.value ?? 'plain'}
                  id={`lang-opt-${i}`}
                  data-index={i}
                  data-testid="code-language-option"
                  role="option"
                  aria-selected={i === active}
                  className={`lang-option${i === active ? ' active' : ''}${o.value === value ? ' current' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                >
                  <span className="lang-option-label">{o.label}</span>
                  {o.hint && <span className="lang-option-hint">{o.hint}</span>}
                  {o.value === value && (
                    <svg className="lang-check" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                      <path d="M2.5 6.2 5 8.5 9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
