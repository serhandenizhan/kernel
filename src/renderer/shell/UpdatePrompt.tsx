import { useEffect, useState } from 'react'
import type { UpdateOffer } from '@shared/types'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { useT } from '../lib/i18n'

// Açılıştan kısa süre sonra GitHub'daki son sürümü denetler; yeni sürüm varsa köşede sorar (çalışmayı bölmez)
const CHECK_DELAY_MS = 1500

export function UpdatePrompt() {
  const t = useT()
  const [offer, setOffer] = useState<UpdateOffer | null>(null)

  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      void kernel.updates
        .check()
        .then((o) => alive && setOffer(o))
        .catch(() => undefined)
    }, CHECK_DELAY_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  if (!offer) return null
  const skip = () => {
    const { updates } = useStore.getState().settings
    void useStore.getState().setSettings({ updates: { ...updates, skipped: offer.version } })
    setOffer(null)
  }
  return (
    <div className="update-prompt glass" role="dialog" aria-label={t('update.title', { version: offer.version })} data-testid="update-prompt">
      <strong>{t('update.title', { version: offer.version })}</strong>
      <p>{t('update.body', { current: offer.current })}</p>
      {offer.notes.trim() && (
        <details>
          <summary>{t('update.notes')}</summary>
          <pre className="update-notes">{offer.notes.trim()}</pre>
        </details>
      )}
      <div className="update-actions">
        <button className="btn small" data-testid="update-skip" onClick={skip}>
          {t('update.skip')}
        </button>
        <span className="spacer" />
        <button className="btn small" data-testid="update-later" onClick={() => setOffer(null)}>
          {t('update.later')}
        </button>
        <button
          className="btn small primary"
          data-testid="update-download"
          onClick={() => {
            void kernel.updates.open(offer.url)
            setOffer(null)
          }}
        >
          {t('update.download')}
        </button>
      </div>
    </div>
  )
}
