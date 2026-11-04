// Açık sayfanın dosyası dışarıda değişti ve bizde kaydedilmemiş değişiklik var
export function ConflictDialog({ onKeepMine, onLoadDisk }: { onKeepMine(): void; onLoadDisk(): void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal glass" role="dialog" aria-labelledby="conflict-title">
        <h3 id="conflict-title">Dosya dışarıda değişti</h3>
        <p>Bu sayfanın dosyası başka bir uygulamada düzenlendi. Hangi sürüm kalsın?</p>
        <div className="modal-actions">
          <button className="btn" onClick={onLoadDisk}>
            Diskteki sürümü yükle
          </button>
          <button className="btn primary" onClick={onKeepMine}>
            Benimkini koru
          </button>
        </div>
      </div>
    </div>
  )
}
