import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import katex from 'katex'
import type { Editor } from '@tiptap/react'
import { useMathEdit } from './math-state'

function validate(latex: string, display: boolean): string | null {
  try {
    katex.renderToString(latex, { throwOnError: true, displayMode: display, strict: 'ignore' })
    return null
  } catch (e) {
    return e instanceof Error ? e.message.replace(/^KaTeX parse error: /, '') : 'Geçersiz formül'
  }
}

// Formül düzenleme alanı: yalnızca geçerli LaTeX belgeye uygulanır (son geçerli render korunur)
export function MathPopover({ editor }: { editor: Editor | null }) {
  const { kind, pos, latex, close } = useMathEdit()
  const [draft, setDraft] = useState(latex)
  const [rect, setRect] = useState<{ left: number; top: number } | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setDraft(latex), [latex, kind, pos])

  useLayoutEffect(() => {
    if (!kind || !editor) return
    const dom = editor.view.nodeDOM(pos) as HTMLElement | null
    const r = dom?.getBoundingClientRect()
    if (r) setRect({ left: Math.min(r.left, window.innerWidth - 440), top: r.bottom + 8 })
  }, [kind, pos, editor])

  const openedAt = useRef(0)

  // ProseMirror işlem sonrası odağı editöre geri verebilir; odağı bir kare sonra al
  useEffect(() => {
    if (!kind || !rect) return
    openedAt.current = performance.now()
    window.dispatchEvent(new CustomEvent('kernel:tip', { detail: 'first-math' }))
    ref.current?.focus()
    ref.current?.select()
    // ikinci deneme yalnızca odak kaçtıysa; seçim yapmaz (aradaki yazılan harfler silinmesin)
    const raf = requestAnimationFrame(() => {
      if (document.activeElement !== ref.current) ref.current?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [kind, pos, rect === null])

  const error = useMemo(() => (draft.trim() ? validate(draft, kind === 'block') : null), [draft, kind])

  const apply = (value: string) => {
    if (!editor || !kind) return
    const cmd = kind === 'block' ? 'updateBlockMath' : 'updateInlineMath'
    ;(editor.commands as unknown as Record<string, (o: { latex: string; pos: number }) => boolean>)[cmd]?.({ latex: value, pos })
  }

  const finish = () => {
    if (!editor || !kind) return
    // boş formül silinir
    if (!draft.trim()) {
      const cmd = kind === 'block' ? 'deleteBlockMath' : 'deleteInlineMath'
      ;(editor.commands as unknown as Record<string, (o: { pos: number }) => boolean>)[cmd]?.({ pos })
    }
    close()
    editor.commands.focus()
  }

  if (!kind || !rect) return null
  return (
    <div className="math-popover glass" style={{ left: rect.left, top: rect.top }} onMouseDown={(e) => e.stopPropagation()}>
      <textarea
        ref={ref}
        className="math-input"
        data-testid="math-input"
        value={draft}
        rows={kind === 'block' ? 3 : 1}
        spellCheck={false}
        placeholder="LaTeX yaz, örn. \frac{a}{b}"
        onChange={(e) => {
          const v = e.target.value
          setDraft(v)
          if (v.trim() && !validate(v, kind === 'block')) apply(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || (e.key === 'Enter' && (kind === 'inline' || e.metaKey))) {
            e.preventDefault()
            finish()
          }
        }}
        onBlur={() => {
          // açılıştan hemen sonra editör odağı geri alırsa kapatma, odağı geri al
          if (performance.now() - openedAt.current < 300) {
            requestAnimationFrame(() => ref.current?.focus())
            return
          }
          finish()
        }}
      />
      {error ? (
        <div className="math-error" data-testid="math-error">
          {error}
        </div>
      ) : (
        <div className="math-hint">{kind === 'block' ? '⌘↵ ile bitir' : '↵ ile bitir'}</div>
      )}
    </div>
  )
}
