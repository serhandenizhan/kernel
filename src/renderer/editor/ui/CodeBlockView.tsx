import { useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { SUPPORTED_LANGUAGES } from '@core/smart-paste/language'
import { normalizeLanguage } from '@core/smart-paste/language'

const LABELS: Record<string, string> = { cpp: 'C++', csharp: 'C#', javascript: 'JavaScript', typescript: 'TypeScript', html: 'HTML', css: 'CSS', json: 'JSON', yaml: 'YAML', sql: 'SQL', php: 'PHP' }
const label = (l: string) => LABELS[l] ?? l.charAt(0).toUpperCase() + l.slice(1)

// Kod bloğu: dil seçici (aranabilir), satır numarası, kopyala
export function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = (node.attrs['language'] as string | null) ?? ''
  const lineNumbers = Boolean(node.attrs['lineNumbers'])
  const [copied, setCopied] = useState(false)
  const lines = node.textContent.split('\n').length

  return (
    <NodeViewWrapper className={`code-block${lineNumbers ? ' with-lines' : ''}`} data-language={language || undefined}>
      <div className="code-toolbar" contentEditable={false}>
        <input
          className="code-lang"
          data-testid="code-language"
          list="kernel-code-languages"
          placeholder="Düz metin"
          value={language}
          disabled={!editor.isEditable}
          onChange={(e) => updateAttributes({ language: e.target.value ? normalizeLanguage(e.target.value) : null })}
        />
        <button className="code-btn" title="Satır numaraları" onClick={() => updateAttributes({ lineNumbers: !lineNumbers })}>
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
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <pre data-lines={lines}>
        {lineNumbers && (
          <span className="line-gutter" contentEditable={false} aria-hidden>
            {Array.from({ length: lines }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </span>
        )}
        <NodeViewContent<'code'> as="code" />
      </pre>
      <datalist id="kernel-code-languages">
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l} value={l}>
            {label(l)}
          </option>
        ))}
      </datalist>
    </NodeViewWrapper>
  )
}
