import { useEffect } from 'react'
import type { Settings } from '@shared/types'
import { useStore } from '../state/store'
import { kernel } from '../lib/kernel'

// Ayarlar (Cmd+,): görünüm, yapıştırma, ipuçları, kasa
export function SettingsDialog() {
  const settings = useStore((s) => s.settings)
  const vaultPath = useStore((s) => s.vaultPath)
  const set = (patch: Partial<Settings>) => void useStore.getState().setSettings(patch)
  const close = () => useStore.getState().setOverlay(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal settings glass" role="dialog" aria-label="Ayarlar" data-testid="settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Ayarlar</h3>

        <section>
          <h4>Görünüm</h4>
          <label className="setting-row">
            <span>Tema</span>
            <select data-testid="setting-theme" value={settings.theme} onChange={(e) => set({ theme: e.target.value as Settings['theme'] })}>
              <option value="system">Sistemi takip et</option>
              <option value="light">Açık</option>
              <option value="dark">Koyu</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Not metni fontu</span>
            <select data-testid="setting-font" value={settings.bodyFont} onChange={(e) => set({ bodyFont: e.target.value as Settings['bodyFont'] })}>
              <option value="serif">New York (serif)</option>
              <option value="sans">SF Pro (sans)</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Sayfa genişliği</span>
            <select data-testid="setting-width" value={settings.pageWidth} onChange={(e) => set({ pageWidth: e.target.value as Settings['pageWidth'] })}>
              <option value="narrow">Dar</option>
              <option value="normal">Normal</option>
              <option value="wide">Geniş</option>
            </select>
          </label>
        </section>

        <section>
          <h4>Akıllı yapıştırma</h4>
          <label className="setting-check">
            <input type="checkbox" data-testid="setting-strip-citations" checked={settings.paste.stripCitations} onChange={(e) => set({ paste: { ...settings.paste, stripCitations: e.target.checked } })} />
            NotebookLM kaynak numaralarını temizle ([1], [2, 3])
          </label>
          <label className="setting-check">
            <input type="checkbox" checked={settings.paste.latexLineHeuristic} onChange={(e) => set({ paste: { ...settings.paste, latexLineHeuristic: e.target.checked } })} />
            Ayraçsız LaTeX satırlarını formüle çevir
          </label>
          <label className="setting-check">
            <input type="checkbox" checked={settings.paste.unfencedCodeHeuristic} onChange={(e) => set({ paste: { ...settings.paste, unfencedCodeHeuristic: e.target.checked } })} />
            Çitsiz kodu kod bloğu yap
          </label>
        </section>

        <section>
          <h4>İpuçları</h4>
          <label className="setting-check">
            <input type="checkbox" checked={settings.tips.enabled} onChange={(e) => set({ tips: { ...settings.tips, enabled: e.target.checked } })} />
            Bir özelliği ilk kullandığımda ipucu göster
          </label>
          <button className="btn small" onClick={() => set({ tips: { ...settings.tips, seen: [] }, tourDone: false })}>
            İpuçlarını ve turu sıfırla
          </button>
        </section>

        <section>
          <h4>Kasa</h4>
          <div className="setting-path">{vaultPath}</div>
          <div className="setting-actions">
            <button className="btn small" onClick={() => void kernel.vault.reveal('')}>
              Finder'da göster
            </button>
            <button
              className="btn small"
              onClick={async () => {
                const res = await kernel.vault.choose(false)
                if (res) {
                  close()
                  await useStore.getState().init()
                }
              }}
            >
              Başka bir kasa seç
            </button>
          </div>
        </section>

        <div className="modal-actions">
          <button className="btn primary" onClick={close}>
            Tamam
          </button>
        </div>
      </div>
    </div>
  )
}
