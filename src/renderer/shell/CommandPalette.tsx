import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { useT } from '../lib/i18n'
import { COMMANDS, filterCommands } from '../commands'

// Cmd+P: komut paleti (arama paletiyle aynı cam görünüm)
export function CommandPalette() {
  const t = useT()
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)
  const rows = useMemo(() => filterCommands(COMMANDS, q), [q])
  const close = () => useStore.getState().setOverlay(null)
  const run = (i: number) => {
    const cmd = rows[i]
    if (!cmd) return
    close()
    cmd.run()
  }

  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={close}>
      <div className="palette glass" data-testid="command-palette" role="dialog" aria-label={t('sc.palette')} onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="palette-input"
          data-testid="command-input"
          autoFocus
          placeholder={t('cmd.placeholder')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setIndex(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(rows.length - 1, i + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(0, i - 1))
            } else if (e.key === 'Enter') run(index)
          }}
        />
        <div className="palette-list">
          {rows.map((c, i) => (
            <button key={c.id} data-testid="command-row" className={`palette-row command-row${i === index ? ' active' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => run(i)}>
              <span className="palette-title">{t(c.label)}</span>
              {c.keys && <kbd className="command-keys">{c.keys}</kbd>}
            </button>
          ))}
          {!rows.length && <div className="palette-empty">{t('cmd.noMatch')}</div>}
        </div>
      </div>
    </div>
  )
}
