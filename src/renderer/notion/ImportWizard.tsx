import { useEffect, useState } from 'react'
import type { ImportProgress, ImportReport } from '@shared/types'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'

type Step = 'intro' | 'token' | 'pages' | 'progress' | 'report'
const STEPS: Step[] = ['intro', 'token', 'pages', 'progress', 'report']

// Notion'dan aktarım sihirbazı (spec §10)
export function ImportWizard({ resume = false }: { resume?: boolean }) {
  const [step, setStep] = useState<Step>(resume ? 'progress' : 'intro')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<string | null>(null)
  const [pages, setPages] = useState<{ id: string; title: string; icon?: string }[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [deleteToken, setDeleteToken] = useState(true)
  const [busy, setBusy] = useState(false)
  const close = () => useStore.getState().setOverlay(null)

  useEffect(
    () =>
      kernel.notion.onProgress((p) => {
        setProgress(p)
        if (p.phase === 'done' && p.report) {
          setReport(p.report)
          setStep('report')
        }
        if (p.phase === 'error') setError(p.error ?? 'Aktarım durdu')
      }),
    []
  )

  useEffect(() => {
    if (resume) void kernel.notion.resume()
  }, [resume])

  const connect = async () => {
    setBusy(true)
    setError(null)
    const res = await kernel.notion.connect(token)
    setBusy(false)
    if (!res.ok) return setError(res.error)
    setWorkspace(res.workspace)
    setToken('')
    const list = await kernel.notion.pages()
    setPages(list)
    setSelected(new Set())
    setStep('pages')
  }

  const start = async () => {
    setError(null)
    setStep('progress')
    try {
      await kernel.notion.start([...selected])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktarım başlatılamadı')
    }
  }

  const finish = async () => {
    if (deleteToken) await kernel.notion.disconnect()
    await useStore.getState().refreshTree()
    if (report?.rootPageId) useStore.getState().openPage(report.rootPageId)
    close()
  }

  const pct = progress && progress.pagesTotal ? Math.round((progress.pagesDone / progress.pagesTotal) * 100) : 0

  return (
    <div className="modal-backdrop">
      <div className="modal notion-wizard glass" data-testid="notion-wizard" role="dialog" aria-label="Notion'dan aktar">
        <div className="tour-dots">
          {STEPS.map((s) => (
            <span key={s} className={s === step ? 'on' : ''} />
          ))}
        </div>

        {step === 'intro' && (
          <>
            <h3>Notion'dan aktar</h3>
            <p>Sayfaların; ikonları, kapakları, görselleri ve formülleriyle birlikte Kernel'e gelir. Notion'da üç adım:</p>
            <ol className="wizard-steps">
              <li>
                <b>notion.so/my-integrations</b> adresinde <b>New integration</b> → ad: "Kernel" → <b>Internal</b> → Kaydet.
              </li>
              <li>
                Açılan sayfada <b>Internal Integration Secret</b>'ı kopyala (<code>secret_…</code> ya da <code>ntn_…</code>).
              </li>
              <li>
                Aktarmak istediğin her ana sayfada sağ üstte <b>•••</b> → <b>Connections</b> → <b>Kernel</b>'i seç. Alt sayfalar otomatik gelir.
              </li>
            </ol>
            <p className="setting-hint">Token yalnızca bu Mac'in Anahtar Zinciri'nde şifreli tutulur; notlarına ya da başka bir yere yazılmaz.</p>
            <div className="modal-actions">
              <button className="btn" onClick={close}>
                Vazgeç
              </button>
              <button className="btn primary" data-testid="notion-next" onClick={() => setStep('token')}>
                Devam
              </button>
            </div>
          </>
        )}

        {step === 'token' && (
          <>
            <h3>Token'ı yapıştır</h3>
            <input className="picker-search wide" type="password" data-testid="notion-token" autoFocus placeholder="secret_… ya da ntn_…" value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && token && void connect()} />
            {error && (
              <div className="mermaid-error" data-testid="notion-error">
                {error}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn" onClick={() => setStep('intro')}>
                Geri
              </button>
              <button className="btn primary" data-testid="notion-connect" disabled={!token || busy} onClick={() => void connect()}>
                {busy ? 'Bağlanıyor…' : 'Bağlan'}
              </button>
            </div>
          </>
        )}

        {step === 'pages' && (
          <>
            <h3>Hangi sayfalar gelsin?</h3>
            <div className="setting-hint" data-testid="notion-workspace">
              Bağlandı: {workspace}
            </div>
            {pages.length === 0 ? (
              <p>Paylaşılmış sayfa bulunamadı. Notion'da sayfada ••• → Connections → Kernel adımını kontrol et.</p>
            ) : (
              <div className="notion-pages">
                <label className="setting-check">
                  <input type="checkbox" data-testid="notion-select-all" checked={selected.size === pages.length} onChange={(e) => setSelected(e.target.checked ? new Set(pages.map((p) => p.id)) : new Set())} />
                  <b>Hepsini seç</b>
                </label>
                {pages.map((p) => (
                  <label key={p.id} className="setting-check" data-testid="notion-page">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={(e) => {
                        const next = new Set(selected)
                        if (e.target.checked) next.add(p.id)
                        else next.delete(p.id)
                        setSelected(next)
                      }}
                    />
                    {p.icon ?? '📄'} {p.title}
                  </label>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn" onClick={close}>
                Vazgeç
              </button>
              <button className="btn primary" data-testid="notion-start" disabled={!selected.size} onClick={() => void start()}>
                Aktar
              </button>
            </div>
          </>
        )}

        {step === 'progress' && (
          <>
            <h3>{progress?.phase === 'scanning' ? 'Sayfalar taranıyor…' : progress?.phase === 'canceled' ? 'Aktarım durduruldu' : 'Aktarılıyor…'}</h3>
            <div className="progress-bar">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="setting-hint">
              {progress ? `${progress.pagesDone} / ${progress.pagesTotal}` : 'Başlıyor…'} {progress?.current ? `— ${progress.current}` : ''}
            </div>
            {error && <div className="mermaid-error">{error}. Bağlantını kontrol edip "Devam et" diyebilirsin.</div>}
            <div className="modal-actions">
              {progress?.phase === 'canceled' || error ? (
                <>
                  <button className="btn" onClick={close}>
                    Kapat
                  </button>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setError(null)
                      void kernel.notion.resume()
                    }}
                  >
                    Devam et
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => void kernel.notion.cancel()}>
                  Durdur
                </button>
              )}
            </div>
          </>
        )}

        {step === 'report' && report && (
          <>
            <h3>Aktarım tamamlandı</h3>
            <div className="notion-report" data-testid="notion-report">
              <p>
                <b>{report.pages} sayfa</b> ve <b>{report.files} dosya</b> aktarıldı.
              </p>
              {(report.failedFiles.length > 0 || report.unsupported.length > 0 || report.mismatches.length > 0) && (
                <p>
                  {report.failedFiles.length} dosya indirilemedi, {report.unsupported.length} blok desteklenmiyor. Ayrıntılar "Notion aktarım raporu" sayfasında.
                </p>
              )}
            </div>
            <label className="setting-check">
              <input type="checkbox" checked={deleteToken} onChange={(e) => setDeleteToken(e.target.checked)} />
              Notion token'ını bu Mac'ten sil
            </label>
            <div className="modal-actions">
              <button className="btn primary" data-testid="notion-finish" onClick={() => void finish()}>
                Bitir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
