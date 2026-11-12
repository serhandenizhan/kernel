import { useEffect, useState } from 'react'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { useLang, useT } from '../lib/i18n'
import { releaseNotes } from '@core/release-notes'

// Açılıştan kısa süre sonra GitHub'daki son sürümü denetler; yeni sürüm varsa köşede sorar (çalışmayı bölmez)
const CHECK_DELAY_MS = 1500

export function UpdatePrompt() {
  const t = useT()
  const lang = useLang()
  const offer = useStore((s) => s.updateOffer)
  const setOffer = useStore.getState().setUpdateOffer
  // null: bekliyor; 0–1: indiriliyor; 'restart': yeniden başlatılıyor
  const [progress, setProgress] = useState<number | 'restart' | null>(null)

  useEffect(() => kernel.updates.onProgress((r) => setProgress((p) => (p === 'restart' ? p : r))), [])

  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      void kernel.updates
        .check()
        .then((o) => alive && o && setOffer(o))
        .catch(() => undefined)
    }, CHECK_DELAY_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  if (!offer) return null
  const notes = releaseNotes(offer.notes, lang)
  const busy = progress !== null
  const install = async () => {
    setProgress(0)
    const res = await kernel.updates.install().catch(() => 'manual' as const)
    if (res === 'restarting') {
      setProgress('restart')
      return
    }
    // bu kurulumda kendini güncelleyemiyor (örn. disk görüntüsünden çalışıyor): dosya tarayıcıda açılır
    void kernel.updates.open(offer.url)
    setProgress(null)
    setOffer(null)
  }
  const skip = () => {
    const { updates } = useStore.getState().settings
    void useStore.getState().setSettings({ updates: { ...updates, skipped: offer.version } })
    setOffer(null)
  }
  return (
    <div className="update-prompt glass" role="dialog" aria-label={t('update.title', { version: offer.version })} data-testid="update-prompt">
      <strong>{t('update.title', { version: offer.version })}</strong>
      <p>{t(offer.install ? 'update.bodyInstall' : 'update.body', { current: offer.current })}</p>
      {notes.length > 0 && (
        <div className="update-notes" data-testid="update-notes" aria-label={t('update.notes')}>
          <span className="update-notes-title">{t('update.notes')}</span>
          {notes.map((n, i) =>
            n.kind === 'heading' ? (
              <h5 key={i}>{n.text}</h5>
            ) : n.kind === 'item' ? (
              <div key={i} className="update-note-item">
                {n.text}
              </div>
            ) : (
              <p key={i}>{n.text}</p>
            )
          )}
        </div>
      )}
      {busy ? (
        <div className="update-progress" data-testid="update-progress">
          <div className="update-bar">
            <span style={{ width: `${Math.round((progress === 'restart' ? 1 : progress) * 100)}%` }} />
          </div>
          <span>{progress === 'restart' ? t('update.restarting') : t('update.downloading', { p: Math.round(progress * 100) })}</span>
        </div>
      ) : (
        <div className="update-actions">
          <button className="btn small" data-testid="update-skip" onClick={skip}>
            {t('update.skip')}
          </button>
          <span className="spacer" />
          <button className="btn small" data-testid="update-later" onClick={() => setOffer(null)}>
            {t('update.later')}
          </button>
          {offer.install ? (
            <button className="btn small primary" data-testid="update-install" onClick={() => void install()}>
              {t('update.install')}
            </button>
          ) : (
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
          )}
        </div>
      )}
    </div>
  )
}
