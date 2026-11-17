import type { Editor } from '@tiptap/core'
import type { IconName } from '../assets/icons'
import { tNow } from '../lib/i18n'

// Blok türleri: blok menüsünün "Dönüştür" alt menüsü ve metin araç çubuğundaki tür seçicisi aynı listeyi kullanır
export interface BlockType {
  id: string
  label: () => string
  icon: IconName
  /** imlecin bulunduğu blok bu türde mi */
  active: (e: Editor) => boolean
  /** imlecin bulunduğu bloğu bu türe çevirir */
  apply: (e: Editor) => void
}

/** İmlecin bulunduğu bloğun türü, belge yapısından okunur (isActive seçimli metinde güvenilir değil) */
export function blockKind(e: Editor): string | null {
  const { $from } = e.state.selection
  const parent = $from.parent
  if (parent.type.name === 'codeBlock') return 'code'
  // en yakın kapsayıcı (liste / alıntı) türü belirler
  for (let d = $from.depth - 1; d > 0; d--) {
    const n = $from.node(d).type.name
    if (n === 'taskList') return 'task'
    if (n === 'orderedList') return 'ordered'
    if (n === 'bulletList') return 'bullet'
    if (n === 'blockquote') return 'quote'
    if (n === 'tableCell' || n === 'tableHeader' || n === 'callout' || n === 'details' || n === 'detailsContent') return null
  }
  if (parent.type.name === 'heading') return `h${parent.attrs['level'] as number}`
  if (parent.type.name === 'paragraph') return 'text'
  return null
}
// liste / alıntı içindeyse önce düz paragrafa çıkar (ayrı bir adım: aynı işlemde tür değiştirmek editörde hata veriyor)
const unwrap = (e: Editor) => {
  const kind = blockKind(e)
  if (kind === 'bullet') e.chain().focus().toggleBulletList().run()
  else if (kind === 'ordered') e.chain().focus().toggleOrderedList().run()
  else if (kind === 'task') e.chain().focus().toggleTaskList().run()
  else if (kind === 'quote') e.chain().focus().lift('blockquote').run()
}
const plain = (e: Editor) => {
  unwrap(e)
  return e.chain().focus()
}

const LISTS = ['bullet', 'ordered', 'task']
// listeden listeye geçişte TipTap liste türünü kendisi değiştirir; önce düz metne çıkarmak gerekmez
const toList = (e: Editor, run: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => {
  const kind = blockKind(e)
  if (kind && LISTS.includes(kind)) run(e.chain().focus()).run()
  else {
    unwrap(e)
    if (blockKind(e) !== 'text') e.chain().focus().setParagraph().run()
    run(e.chain().focus()).run()
  }
}

export const BLOCK_TYPES: BlockType[] = [
  { id: 'text', label: () => tNow('slash.text'), icon: 'text', active: (e) => blockKind(e) === 'text', apply: (e) => {
      unwrap(e)
      if (blockKind(e) !== 'text') e.chain().focus().setParagraph().run()
    } },
  ...([1, 2, 3] as const).map((level) => ({
    id: `h${level}`,
    label: () => tNow('slash.heading', { level }),
    icon: `h${level}` as IconName,
    active: (e: Editor) => blockKind(e) === `h${level}`,
    apply: (e: Editor) => plain(e).setNode('heading', { level }).run()
  })),
  { id: 'bullet', label: () => tNow('slash.bullet'), icon: 'list', active: (e) => blockKind(e) === 'bullet', apply: (e) => toList(e, (c) => c.toggleBulletList()) },
  { id: 'ordered', label: () => tNow('slash.ordered'), icon: 'list-ordered', active: (e) => blockKind(e) === 'ordered', apply: (e) => toList(e, (c) => c.toggleOrderedList()) },
  { id: 'task', label: () => tNow('slash.task'), icon: 'todo', active: (e) => blockKind(e) === 'task', apply: (e) => toList(e, (c) => c.toggleTaskList()) },
  { id: 'quote', label: () => tNow('slash.quote'), icon: 'quote', active: (e) => blockKind(e) === 'quote', apply: (e) => {
      unwrap(e)
      if (blockKind(e) !== 'text') e.chain().focus().setParagraph().run()
      e.chain().focus().toggleBlockquote().run()
    } },
  { id: 'code', label: () => tNow('slash.code'), icon: 'code-block', active: (e) => blockKind(e) === 'code', apply: (e) => plain(e).setCodeBlock().run() }
]

/** İmlecin bulunduğu bloğun türü (listede yoksa null: ör. tablo, görsel) */
export function currentBlockType(e: Editor): BlockType | null {
  const kind = blockKind(e)
  return BLOCK_TYPES.find((t) => t.id === kind) ?? null
}
