import { useT } from '../lib/i18n'

// Açık sayfanın dosyası dışarıda değişti ve bizde kaydedilmemiş değişiklik var
export function ConflictDialog({ onKeepMine, onLoadDisk }: { onKeepMine(): void; onLoadDisk(): void }) {
  const t = useT()
  return (
    <div className="modal-backdrop">
      <div className="modal glass" role="dialog" aria-labelledby="conflict-title">
        <h3 id="conflict-title">{t('conflict.title')}</h3>
        <p>{t('conflict.body')}</p>
        <div className="modal-actions">
          <button className="btn" onClick={onLoadDisk}>
            {t('conflict.loadDisk')}
          </button>
          <button className="btn primary" onClick={onKeepMine}>
            {t('conflict.keepMine')}
          </button>
        </div>
      </div>
    </div>
  )
}
