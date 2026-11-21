import { Component, type ReactNode } from 'react'

export function PageCrashFallback({ title, actionLabel, onHome }: { title: string; actionLabel: string; onHome(): void }) {
  return (
    <div className="empty-state" data-testid="error-fallback" role="alert">
      <h2>{title}</h2>
      <button type="button" className="btn primary" data-testid="error-back-home" onClick={onHome}>
        {actionLabel}
      </button>
    </div>
  )
}

// Sayfa alanındaki beklenmedik bir hata bütün arayüzü (kenar çubuğu dahil) boşaltmasın
export class ErrorBoundary extends Component<{ fallback: ReactNode; resetKey: unknown; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error)
  }
  componentDidUpdate(prev: { resetKey: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
