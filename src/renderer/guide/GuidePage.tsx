import { useEffect, useMemo, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import katex from 'katex'
import { normalizeTr } from '@core/normalize-tr'
import { convertPaste } from '@core/smart-paste'
import { buildExtensions } from '../editor/extensions'
import { SLASH_ITEMS } from '../editor/slash-items'
import { useStore } from '../state/store'
import { SHORTCUTS } from './shortcuts'
import { MermaidPreview } from '../editor/ui/MermaidView'
import { useT, tNow } from '../lib/i18n'
import type { MessageKey } from '@shared/i18n'

/** Tuş gösterimi: sözlük anahtarıysa (sc.*) çevrilir */
const keysOf = (keys: string) => (keys.startsWith('sc.') ? tNow(keys as MessageKey) : keys)

/** Canlı örnek: ham NotebookLM metni → Kernel'in dönüşümü (uygulamanın kendi bileşenleriyle) */
function PasteDemo() {
  const t = useT()
  const SAMPLE = t('guide.paste.sample')
  const doc = useMemo(() => convertPaste({ text: SAMPLE }, { stripCitations: true, latexLineHeuristic: true, unfencedCodeHeuristic: true }).doc, [SAMPLE])
  const editor = useEditor({ extensions: buildExtensions({ readOnly: true }), content: doc, editable: false })
  return (
    <div className="demo-split" data-testid="guide-paste-demo">
      <div>
        <div className="demo-label">{t('guide.paste.from')}</div>
        <pre className="demo-raw">{SAMPLE}</pre>
      </div>
      <div>
        <div className="demo-label">{t('guide.paste.to')}</div>
        <div className="kernel-editor demo-render">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

function MathDemo() {
  const t = useT()
  const [latex, setLatex] = useState('\\int_0^1 x^2\\,dx = \\frac{1}{3}')
  const html = useMemo(() => katex.renderToString(latex, { throwOnError: false, displayMode: true }), [latex])
  return (
    <div className="demo-split">
      <div>
        <div className="demo-label">{t('guide.math.latex')}</div>
        <input className="picker-search" style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 13 }} value={latex} onChange={(e) => setLatex(e.target.value)} spellCheck={false} />
      </div>
      <div>
        <div className="demo-label">{t('guide.math.result')}</div>
        <div className="demo-math" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}

// Kernel Rehberi (Cmd+/): kasaya yazılmayan, uygulama içi sayfa
export function GuidePage() {
  const [q, setQ] = useState('')
  const t = useT()
  const close = () => useStore.getState().setOverlay(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const rows = useMemo(() => {
    const n = normalizeTr(q.trim())
    return SHORTCUTS.filter((s) => s.phase === 1).filter((s) => !n || normalizeTr(`${t(s.action)} ${t(s.group)} ${keysOf(s.keys)}`).includes(n))
  }, [q, t])

  return (
    <article className="page guide" data-testid="guide">
      <div className="page-column">
        <button className="icon-btn guide-close" aria-label={t('guide.close')} onClick={close}>
          ×
        </button>
        <h1 className="page-title">{t('guide.title')}</h1>
        <p className="guide-lead">{t('guide.lead')}</p>

        <section className="guide-section">
          <h2>{t('guide.paste.title')}</h2>
          <p dangerouslySetInnerHTML={{ __html: t('guide.paste.body') }} />
          <PasteDemo />
        </section>

        <section className="guide-section">
          <h2>{t('guide.math.title')}</h2>
          <p dangerouslySetInnerHTML={{ __html: t('guide.math.body') }} />
          <MathDemo />
        </section>

        <section className="guide-section">
          <h2>{t('guide.blocks.title')}</h2>
          <p>{t('guide.blocks.body')}</p>
          <div className="guide-blocks">
            {SLASH_ITEMS.map((it) => (
              <span key={it.id} className="guide-block">
                <span className="slash-icon">{it.icon}</span>
                {it.label}
              </span>
            ))}
          </div>
        </section>

        <section className="guide-section">
          <h2>{t('guide.icon.title')}</h2>
          <p>{t('guide.icon.body')}</p>
        </section>

        <section className="guide-section">
          <h2>{t('guide.search.title')}</h2>
          <p>{t('guide.search.body')}</p>
        </section>

        <section className="guide-section">
          <h2>{t('guide.notion.title')}</h2>
          <p>{t('guide.notion.body')}</p>
          <button
            className="btn"
            data-testid="guide-notion"
            onClick={() => {
              close()
              useStore.getState().setOverlay('notion')
            }}
          >
            {t('guide.notion.open')}
          </button>
        </section>

        <section className="guide-section">
          <h2>{t('guide.history.title')}</h2>
          <p>{t('guide.history.body')}</p>
        </section>

        <section className="guide-section">
          <h2>{t('guide.templates.title')}</h2>
          <p dangerouslySetInnerHTML={{ __html: t('guide.templates.body') }} />
        </section>

        <section className="guide-section">
          <h2>{t('guide.diagram.title')}</h2>
          <p dangerouslySetInnerHTML={{ __html: t('guide.diagram.body') }} />
          <div className="demo-math" data-testid="guide-mermaid-demo">
            <MermaidPreview code={t('guide.diagram.sample')} />
          </div>
        </section>

        <section className="guide-section">
          <h2>{t('guide.shortcuts.title')}</h2>
          <input className="picker-search shortcut-search" data-testid="shortcut-search" placeholder={t('guide.shortcuts.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <table className="shortcut-table">
            <tbody>
              {rows.map((s) => (
                <tr key={s.keys + s.action} data-testid="shortcut-row">
                  <td>
                    <kbd>{keysOf(s.keys)}</kbd>
                  </td>
                  <td>{t(s.action)}</td>
                  <td className="muted">{t(s.group)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </article>
  )
}
