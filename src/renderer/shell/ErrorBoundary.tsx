import { Component, type ReactNode } from 'react'

// Sayfa alanındaki beklenmedik bir hata bütün arayüzü (kenar çubuğu dahil) boşaltmasın
export class ErrorBoundary extends Component<{ fallback: ReactNode; resetKey: unknown; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidUpdate(prev: { resetKey: unknown }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
