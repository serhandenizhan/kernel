import { useStore } from '../state/store'

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast glass${t.kind === 'error' ? ' error' : ''}`} data-testid="toast">
          {t.message}
        </div>
      ))}
    </div>
  )
}
