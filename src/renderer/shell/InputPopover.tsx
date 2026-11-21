import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

interface Props {
  x: number
  y: number
  initial: string
  placeholder: string
  ariaLabel: string
  testId: string
  onSubmit(value: string): void
  onCancel(): void
}

// Küçük satır içi giriş kutusu (window.prompt yerine: bağlantı adresi, callout özel ikonu)
export function InputPopover({ x, y, initial, placeholder, ariaLabel, testId, onSubmit, onCancel }: Props) {
  const [val, setVal] = useState(initial)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ x, y })

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      x: Math.min(Math.max(8, x), window.innerWidth - r.width - 8),
      y: Math.min(Math.max(8, y), window.innerHeight - r.height - 8)
    })
  }, [x, y])

  useEffect(() => {
    const inp = inputRef.current
    if (!inp) return
    inp.focus()
    if (initial) inp.select()
  }, [initial])

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) onCancel()
    }
    window.addEventListener('mousedown', onMouse)
    return () => window.removeEventListener('mousedown', onMouse)
  }, [onCancel])

  // body'ye çizilir: editör odağı ya da yüzey kayması konumu bozmasın
  return createPortal(
    <div ref={boxRef} className="input-popover glass glass-pop" style={{ left: pos.x, top: pos.y }}>
      <input
        ref={inputRef}
        type="text"
        value={val}
        placeholder={placeholder}
        aria-label={ariaLabel}
        data-testid={testId}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          // editör ve uygulama kısayolları yazmayı kesmesin
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit(val)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
      />
    </div>,
    document.body
  )
}
