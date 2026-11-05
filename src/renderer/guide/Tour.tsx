import { useState } from 'react'
import { useStore } from '../state/store'
import { TIPS, useTip } from './tips'
import logo from '../assets/logo.svg'
import { tNow, useT } from '../lib/i18n'
import type { MessageKey } from '@shared/i18n'

const CARDS: { title: MessageKey; body: MessageKey; visual: string }[] = [
  { title: 'tour.1.title', body: 'tour.1.body', visual: '📁' },
  { title: 'tour.2.title', body: 'tour.2.body', visual: '∑' },
  { title: 'tour.3.title', body: 'tour.3.body', visual: '/' },
  { title: 'tour.4.title', body: 'tour.4.body', visual: '⌘K' },
  { title: 'tour.5.title', body: 'tour.5.body', visual: 'PDF' }
]

// İlk açılış turu (cam pencere)
export function Tour() {
  const [i, setI] = useState(0)
  const finish = () => void useStore.getState().setSettings({ tourDone: true })
  const card = CARDS[i]!
  const t = useT()
  return (
    <div className="modal-backdrop tour-backdrop">
      <div className="tour glass" data-testid="tour" role="dialog" aria-label={t('tour.label')}>
        <div className="tour-visual">{i === 0 ? <img src={logo} width={64} height={64} alt="" /> : <span>{card.visual}</span>}</div>
        <h3>{t(card.title)}</h3>
        <p>{t(card.body)}</p>
        <div className="tour-dots">
          {CARDS.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn" data-testid="tour-skip" onClick={finish}>
            {t('tour.skip')}
          </button>
          {i < CARDS.length - 1 ? (
            <button className="btn primary" data-testid="tour-next" onClick={() => setI(i + 1)}>
              {t('tour.next')}
            </button>
          ) : (
            <button className="btn primary" data-testid="tour-next" onClick={finish}>
              {t('tour.start')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Tek seferlik ipucu baloncuğu
export function TipBubble() {
  const current = useTip((s) => s.current)
  if (!current) return null
  const tip = TIPS[current]
  return (
    <div className="tip glass" data-testid="tip" role="status">
      <div className="tip-head">
        <strong>{tNow(tip.title)}</strong>
        <button className="icon-btn" data-testid="tip-close" aria-label={tNow('tip.close')} onClick={() => useTip.setState({ current: null })}>
          ×
        </button>
      </div>
      <p>{tNow(tip.body)}</p>
    </div>
  )
}
