import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t as translate } from '@shared/i18n'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { currentLang, useT } from '../lib/i18n'
import { Icon, type IconName } from '../assets/icons'
import { ContextMenu } from './ContextMenu'
import { keys } from '../lib/platform'

interface Item {
  id: string
  icon: IconName
  label: string
  hint?: string
  run(): void | Promise<void>
}

/** Varsayılan ders notu şablonundan sayfa açar (şablon adı bu dilde, başka dilde ya da ilk şablon) */
export async function createLectureNote(): Promise<void> {
  const names = await kernel.templates.list()
  const wanted = translate(currentLang(), 'template.defaultName')
  const name = names.find((n) => n === wanted) ?? names.find((n) => (['tr', 'en', 'de'] as const).some((l) => translate(l, 'template.defaultName') === n)) ?? names[0] ?? wanted
  await createFromTemplate(name)
}

/** Şablondan sayfa oluşturur ve açar */
async function createFromTemplate(name: string): Promise<void> {
  const s = useStore.getState()
  const node = await kernel.templates.create(null, name)
  await s.refreshTree()
  s.openPage(node.id)
}

// Kenar çubuğundaki bölünmüş "Yeni" düğmesi: sol parça boş sayfa, ok cam menüyü açar
export function NewButton() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<{ x: number; y: number; names: string[] } | null>(null)
  const anchor = useRef<HTMLDivElement>(null)

  const items: Item[] = [
    { id: 'new-blank', icon: 'doc', label: t('sidebar.blank'), hint: '⌘N', run: () => useStore.getState().createPage(null) },
    {
      id: 'new-lecture',
      icon: 'template',
      label: t('sidebar.lecture'),
      hint: t('sidebar.template'),
      run: createLectureNote
    },
    {
      id: 'new-from-template',
      icon: 'grid',
      label: t('sidebar.fromTemplateShort'),
      run: async () => {
        const r = anchor.current!.getBoundingClientRect()
        setTemplates({ x: r.left, y: r.bottom + 6, names: await kernel.templates.list() })
      }
    },
    { id: 'notion-import', icon: 'download', label: t('sidebar.notionImport'), run: () => useStore.getState().setOverlay('notion') }
  ]

  return (
    <div ref={anchor} className="new-split">
      <button className="new-main" data-testid="new-page" title={t('sidebar.newPage')} onClick={() => void useStore.getState().createPage(null)}>
        <Icon name="plus" size={14} />
        <span>{t('sidebar.new')}</span>
      </button>
      <button className={`new-more${open ? ' open' : ''}`} data-testid="new-menu" aria-label={t('sidebar.newMenu')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="chevron-down" size={12} />
      </button>
      {open && anchor.current && <NewMenuPanel anchor={anchor.current} items={items} onClose={() => setOpen(false)} />}
      {templates && (
        <ContextMenu
          x={templates.x}
          y={templates.y}
          onClose={() => setTemplates(null)}
          items={templates.names.length ? templates.names.map((name) => ({ label: name, onSelect: () => void createFromTemplate(name) })) : [{ label: t('sidebar.noTemplates'), onSelect: () => undefined }]}
        />
      )}
    </div>
  )
}

/** Cam menü: ↑ ↓ ile gezilir, Enter seçer, Esc ya da dışarı tıklama kapatır */
function NewMenuPanel({ anchor, items, onClose }: { anchor: HTMLElement; items: Item[]; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    setPos({ left: r.left, top: r.bottom + 6 })
  }, [anchor])

  // panel çizildikten sonra odak alır (klavye ↑ ↓ Enter Esc çalışsın)
  useEffect(() => {
    if (pos) ref.current?.focus()
  }, [pos])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [anchor, onClose])

  const choose = (it: Item | undefined) => {
    if (!it) return
    onClose()
    void it.run()
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActive((i) => (i + 1) % items.length)
    else if (e.key === 'ArrowUp') setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
    else if (e.key === 'Enter') choose(items[active])
    else if (e.key === 'Escape') onClose()
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  if (!pos) return null
  return createPortal(
    <div ref={ref} className="new-menu glass glass-pop" role="menu" tabIndex={-1} style={pos} onKeyDown={onKey} onBlur={(e) => !ref.current?.contains(e.relatedTarget as Node) && !anchor.contains(e.relatedTarget as Node) && onClose()}>
      {items.map((it, i) => (
        <button
          key={it.id}
          role="menuitem"
          data-testid={it.id}
          className={`new-item${i === active ? ' active' : ''}${it.id === 'notion-import' ? ' sep' : ''}`}
          onMouseEnter={() => setActive(i)}
          onClick={() => choose(it)}
        >
          <Icon name={it.icon} />
          <span className="new-item-label">{it.label}</span>
          {it.hint && <span className="new-item-hint">{keys(it.hint)}</span>}
        </button>
      ))}
    </div>,
    document.body
  )
}
