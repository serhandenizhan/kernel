import { useEffect, useState } from 'react'
import type { ImportProgress, ImportReport } from '@shared/types'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { useT } from '../lib/i18n'

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
  const [busy, setBusy] = useState(false)
  const close = () => useStore.getState().setOverlay(null)
  const t = useT()

  useEffect(
    () =>
      kernel.notion.onProgress((p) => {
        setProgress(p)
        if (p.phase === 'done' && p.report) {
          setReport(p.report)
          setStep('report')
        }
        if (p.phase === 'error') setError(p.error ?? t('notion.stoppedFallback'))
      }),
    []
  )

  const doResume = async () => {
    setError(null)
    try {
      await kernel.notion.resume()
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : t('notion.resumeFailed'))
    }
  }

  useEffect(() => {
    if (resume) void doResume()
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
      setError(e instanceof Error ? e.message : t('notion.startFailed'))
    }
  }

  const finish = async () => {
    // token yalnızca bellekteydi; aktarım bitince hemen unutulur
    await kernel.notion.disconnect()
    await useStore.getState().refreshTree()
    if (report?.rootPageId) useStore.getState().openPage(report.rootPageId)
    close()
  }

  const pct = progress && progress.pagesTotal ? Math.round((progress.pagesDone / progress.pagesTotal) * 100) : 0

  return (
    <div className="modal-backdrop">
      <div className="modal notion-wizard glass" data-testid="notion-wizard" role="dialog" aria-label={t('notion.title')}>
        <div className="tour-dots">
          {STEPS.map((s) => (
            <span key={s} className={s === step ? 'on' : ''} />
          ))}
        </div>

        {step === 'intro' && (
          <>
            <h3>{t('notion.title')}</h3>
            <p>{t('notion.intro')}</p>
            <ol className="wizard-steps">
              <li dangerouslySetInnerHTML={{ __html: t('notion.step1') }} />
              <li dangerouslySetInnerHTML={{ __html: t('notion.step2') }} />
              <li dangerouslySetInnerHTML={{ __html: t('notion.step3') }} />
            </ol>
            <p className="setting-hint">{t('notion.tokenHint')}</p>
            <div className="modal-actions">
              <button className="btn" onClick={close}>
                {t('notion.cancel')}
              </button>
              <button className="btn primary" data-testid="notion-next" onClick={() => setStep('token')}>
                {t('notion.next')}
              </button>
            </div>
          </>
        )}

        {step === 'token' && (
          <>
            <h3>{t('notion.pasteToken')}</h3>
            <input className="picker-search wide" type="password" data-testid="notion-token" autoFocus placeholder={t('notion.tokenPlaceholder')} value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && token && void connect()} />
            {error && (
              <div className="mermaid-error" data-testid="notion-error">
                {error}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn" onClick={() => setStep('intro')}>
                {t('notion.back')}
              </button>
              <button className="btn primary" data-testid="notion-connect" disabled={!token || busy} onClick={() => void connect()}>
                {busy ? t('notion.connecting') : t('notion.connect')}
              </button>
            </div>
          </>
        )}

        {step === 'pages' && (
          <>
            <h3>{t('notion.whichPages')}</h3>
            <div className="setting-hint" data-testid="notion-workspace">
              {t('notion.connected', { workspace: workspace ?? '' })}
            </div>
            {pages.length === 0 ? (
              <p>{t('notion.noPages')}</p>
            ) : (
              <div className="notion-pages">
                <label className="setting-check">
                  <input type="checkbox" data-testid="notion-select-all" checked={selected.size === pages.length} onChange={(e) => setSelected(e.target.checked ? new Set(pages.map((p) => p.id)) : new Set())} />
                  <b>{t('notion.selectAll')}</b>
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
                {t('notion.cancel')}
              </button>
              <button className="btn primary" data-testid="notion-start" disabled={!selected.size} onClick={() => void start()}>
                {t('notion.import')}
              </button>
            </div>
          </>
        )}

        {step === 'progress' && (
          <>
            <h3>{progress?.phase === 'scanning' ? t('notion.scanning') : progress?.phase === 'canceled' ? t('notion.stopped') : t('notion.importing')}</h3>
            <div className="progress-bar">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="setting-hint">
              {progress ? `${progress.pagesDone} / ${progress.pagesTotal}` : t('notion.starting')} {progress?.current ? `— ${progress.current}` : ''}
            </div>
            {error && (
              <div className="mermaid-error" data-testid="notion-error">
                {t('notion.errorRetry', { error })}
              </div>
            )}
            <div className="modal-actions">
              {progress?.phase === 'canceled' || error ? (
                <>
                  <button className="btn" onClick={close}>
                    {t('notion.close')}
                  </button>
                  <button className="btn primary" onClick={() => void doResume()}>
                    {t('notion.resume')}
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => void kernel.notion.cancel()}>
                  {t('notion.stop')}
                </button>
              )}
            </div>
          </>
        )}

        {step === 'report' && report && (
          <>
            <h3>{t('notion.done')}</h3>
            <div className="notion-report" data-testid="notion-report">
              <p dangerouslySetInnerHTML={{ __html: t('notion.summary', { pages: report.pages, files: report.files }) }} />
              {(report.failedFiles.length > 0 || report.unsupported.length > 0 || report.mismatches.length > 0) && (
                <p>{t('notion.problems', { failed: report.failedFiles.length, unsupported: report.unsupported.length })}</p>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn primary" data-testid="notion-finish" onClick={() => void finish()}>
                {t('notion.finish')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
