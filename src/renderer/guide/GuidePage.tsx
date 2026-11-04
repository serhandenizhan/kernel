import { useEffect, useMemo, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import katex from 'katex'
import { normalizeTr } from '@core/normalize-tr'
import { convertPaste } from '@core/smart-paste'
import { buildExtensions } from '../editor/extensions'
import { SLASH_ITEMS } from '../editor/slash-items'
import { useStore } from '../state/store'
import { SHORTCUTS } from './shortcuts'

const SAMPLE = `- **Formül:** \\\\(\\vec{v} \\approx \\lambda \\vec{u}\\\\) olur.
  \\\\[h_t = f(x_t, h_{t-1})\\\\]
- Çıktı boyutu \\\\(256 \\times 2 = 512\\\\)`

/** Canlı örnek: ham NotebookLM metni → Kernel'in dönüşümü (uygulamanın kendi bileşenleriyle) */
function PasteDemo() {
  const doc = useMemo(() => convertPaste({ text: SAMPLE }, { stripCitations: true, latexLineHeuristic: true, unfencedCodeHeuristic: true }).doc, [])
  const editor = useEditor({ extensions: buildExtensions({ readOnly: true }), content: doc, editable: false })
  return (
    <div className="demo-split" data-testid="guide-paste-demo">
      <div>
        <div className="demo-label">Yapıştırdığın (NotebookLM)</div>
        <pre className="demo-raw">{SAMPLE}</pre>
      </div>
      <div>
        <div className="demo-label">Kernel'de görünen</div>
        <div className="kernel-editor demo-render">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}

function MathDemo() {
  const [latex, setLatex] = useState('\\int_0^1 x^2\\,dx = \\frac{1}{3}')
  const html = useMemo(() => katex.renderToString(latex, { throwOnError: false, displayMode: true }), [latex])
  return (
    <div className="demo-split">
      <div>
        <div className="demo-label">LaTeX</div>
        <input className="picker-search" style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 13 }} value={latex} onChange={(e) => setLatex(e.target.value)} spellCheck={false} />
      </div>
      <div>
        <div className="demo-label">Sonuç</div>
        <div className="demo-math" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  )
}

// Kernel Rehberi (Cmd+/): kasaya yazılmayan, uygulama içi sayfa
export function GuidePage() {
  const [q, setQ] = useState('')
  const close = () => useStore.getState().setOverlay(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const rows = useMemo(() => {
    const n = normalizeTr(q.trim())
    return SHORTCUTS.filter((s) => s.phase === 1).filter((s) => !n || normalizeTr(`${s.action} ${s.group} ${s.keys}`).includes(n))
  }, [q])

  return (
    <article className="page guide" data-testid="guide">
      <div className="page-column">
        <button className="icon-btn guide-close" aria-label="Rehberi kapat" onClick={close}>
          ×
        </button>
        <h1 className="page-title">Kernel Rehberi</h1>
        <p className="guide-lead">Kernel'in özellikleri ve kısayolları. Her bölümdeki örnek canlıdır, dokunabilirsin.</p>

        <section className="guide-section">
          <h2>Akıllı yapıştırma</h2>
          <p>Yapay zekâ araçlarından kopyaladığın metni olduğu gibi yapıştır. Çift kaçışlı formüller (\\( \\)), $…$ ve $$…$$ formül olur; kodun dili tespit edilir. Beğenmezsen hemen ⌘Z ile ham metne dönersin, ⌘⇧V ham yapıştırır.</p>
          <PasteDemo />
        </section>

        <section className="guide-section">
          <h2>Formül ve kod</h2>
          <p>
            Satır içinde <code>$x^2$</code> yaz ya da ⌘⇧M'ye bas. Boş satırda <code>$$</code> ve boşluk blok formül açar. Formüle tıklayınca düzenlersin; yalnızca geçerli LaTeX uygulanır. Kod için <code>```python</code> yaz.
          </p>
          <MathDemo />
        </section>

        <section className="guide-section">
          <h2>Bloklar</h2>
          <p>Satır başında / yaz ve aramaya başla. Türkçe karakter gerekmez: "basl" → Başlık.</p>
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
          <h2>İkon ve kapak</h2>
          <p>Başlığın üstüne gelince "İkon ekle" ve "Kapak ekle" belirir. Kapakta hazır desenlerden birini ya da kendi görselini seçip sürükleyerek konumlandırabilirsin.</p>
        </section>

        <section className="guide-section">
          <h2>Arama ve PDF</h2>
          <p>⌘K tüm sayfa adlarında ve içerikte arar. ⌘E sayfayı PDF'e çevirir: metin ve formüller vektörel, görseller tam çözünürlükte; başlıklar sayfa sonunda yalnız kalmaz, kısa kod blokları bölünmez.</p>
        </section>

        <section className="guide-section">
          <h2>Kısayollar</h2>
          <input className="picker-search shortcut-search" data-testid="shortcut-search" placeholder="Kısayol ara" value={q} onChange={(e) => setQ(e.target.value)} />
          <table className="shortcut-table">
            <tbody>
              {rows.map((s) => (
                <tr key={s.keys + s.action} data-testid="shortcut-row">
                  <td>
                    <kbd>{s.keys}</kbd>
                  </td>
                  <td>{s.action}</td>
                  <td className="muted">{s.group}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </article>
  )
}
