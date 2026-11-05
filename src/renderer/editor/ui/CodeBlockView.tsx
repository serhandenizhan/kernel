import { useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { looksLikeMermaid } from '@core/smart-paste/language'
import { getLoadedHighlighter, HIGHLIGHT_LANGUAGES, THEMES } from '../../lib/shiki'
import { MermaidPreview } from './MermaidView'
import { LanguagePicker, languageLabel as label } from './LanguagePicker'
import { tNow } from '../../lib/i18n'

const CHUNK_LINES = 25

/** Baskı (salt okunur) için: kod 25 satırlık parçalar halinde, devam parçalarında etiket tekrarlanır */
function StaticCode({ code, language }: { code: string; language: string }) {
  // içi diyagram olmayan "mermaid" kodu düz kod olarak basılır
  if (language === 'mermaid' && looksLikeMermaid(code)) {
    return (
      <NodeViewWrapper className="code-block static mermaid-block">
        <MermaidPreview code={code} />
        <NodeViewContent<'code'> as="code" style={{ display: 'none' }} />
      </NodeViewWrapper>
    )
  }
  const hl = getLoadedHighlighter()
  const lines = code.split('\n')
  const chunks: string[] = []
  for (let i = 0; i < lines.length; i += CHUNK_LINES) chunks.push(lines.slice(i, i + CHUNK_LINES).join('\n'))
  const name = language ? label(language) : tNow('code.plain')
  return (
    <NodeViewWrapper className="code-block static" data-language={language || undefined}>
      {chunks.map((chunk, i) => (
        <div key={i} className="code-chunk">
          <div className="code-chunk-label">{i === 0 ? name : tNow('code.continued', { name })}</div>
          {hl ? (
            <div dangerouslySetInnerHTML={{ __html: hl.codeToHtml(chunk, { lang: HIGHLIGHT_LANGUAGES.includes(language) ? language : 'text', themes: THEMES, defaultColor: false }) }} />
          ) : (
            <pre>{chunk}</pre>
          )}
        </div>
      ))}
      {/* ProseMirror içeriği için kap (gizli; aksi halde ham metin ikinci kez basılır) */}
      <NodeViewContent<'code'> as="code" style={{ display: 'none' }} />
    </NodeViewWrapper>
  )
}


// Kod bloğu: dil seçici (aranabilir), satır numarası, kopyala
export function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = (node.attrs['language'] as string | null) ?? ''
  const lineNumbers = Boolean(node.attrs['lineNumbers'])
  const [copied, setCopied] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const lines = node.textContent.split('\n').length
  // "mermaid" etiketli ama diyagram olmayan kod (ör. düz metin ağaç) hata yerine kod olarak görünür
  const isMermaid = language === 'mermaid' && looksLikeMermaid(node.textContent)
  if (!editor.isEditable) return <StaticCode code={node.textContent} language={language} />

  return (
    <NodeViewWrapper className={`code-block${lineNumbers ? ' with-lines' : ''}`} data-language={language || undefined}>
      <div className="code-toolbar" contentEditable={false}>
        <LanguagePicker value={language || null} disabled={!editor.isEditable} onChange={(v) => updateAttributes({ language: v })} />
        {isMermaid && (
          <button className="code-btn" data-testid="mermaid-toggle" onClick={() => setShowCode(!showCode)}>
            {showCode ? tNow('code.preview') : tNow('code.code')}
          </button>
        )}
        <button className="code-btn" title={tNow('code.lineNumbers')} onClick={() => updateAttributes({ lineNumbers: !lineNumbers })}>
          #
        </button>
        <button
          className="code-btn"
          onClick={() => {
            void navigator.clipboard.writeText(node.textContent)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
        >
          {copied ? tNow('code.copied') : tNow('code.copy')}
        </button>
      </div>
      {isMermaid && !showCode && <MermaidPreview code={node.textContent} />}
      <pre data-lines={lines} style={isMermaid && !showCode ? { display: 'none' } : undefined}>
        {lineNumbers && (
          <span className="line-gutter" contentEditable={false} aria-hidden>
            {Array.from({ length: lines }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </span>
        )}
        <NodeViewContent<'code'> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
