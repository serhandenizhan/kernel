import { mkdir, readFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { createEmptyCard, fsrs, Rating, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import type { Card } from '@core/cards'
import type { ReviewRating } from '@shared/types'
import { writeAtomic } from './vault/atomic'
import { log } from './log'

const ORPHAN_KEEP_MS = 30 * 86_400_000
const GRADES: Record<ReviewRating, Grade> = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good, easy: Rating.Easy }

/** Diskte saklanan kart durumu (FSRS alanları; tarihler ISO) */
export interface CardState {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: number
  last_review?: string
  /** kart kasada artık yoksa: ilk kaybolduğu an (30 gün sonra silinir) */
  orphanSince?: string
}

const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function validState(v: unknown): CardState | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  if (!isDate(r['due'])) return null
  for (const k of ['stability', 'difficulty', 'elapsed_days', 'scheduled_days', 'reps', 'lapses', 'state']) if (!isNum(r[k])) return null
  const s: CardState = {
    due: r['due'] as string,
    stability: r['stability'] as number,
    difficulty: r['difficulty'] as number,
    elapsed_days: r['elapsed_days'] as number,
    scheduled_days: r['scheduled_days'] as number,
    reps: r['reps'] as number,
    lapses: r['lapses'] as number,
    state: r['state'] as number
  }
  if (isDate(r['last_review'])) s.last_review = r['last_review']
  if (isDate(r['orphanSince'])) s.orphanSince = r['orphanSince']
  return s
}

const toFsrs = (s: CardState): FsrsCard => ({ ...s, due: new Date(s.due), last_review: s.last_review ? new Date(s.last_review) : undefined }) as FsrsCard

// Aralıklı tekrar verisi: .kernel/srs.json → { version: 1, cards: { [kartId]: CardState } } (spec §12, FSRS)
export class SrsStore {
  private readonly file: string
  private cache: Record<string, CardState> | null = null
  private chain: Promise<unknown> = Promise.resolve()
  private readonly scheduler = fsrs()

  constructor(
    root: string,
    private readonly now: () => Date = () => new Date()
  ) {
    this.file = join(root, '.kernel', 'srs.json')
  }

  /** Bozuk dosya silinmez: yanına yedeklenir, boş başlanır; bozuk tek kayıtlar atlanır */
  private async load(): Promise<Record<string, CardState>> {
    if (this.cache) return this.cache
    let text: string
    try {
      text = await readFile(this.file, 'utf8')
    } catch (e) {
      // yalnızca dosya yoksa boş başlanır; başka okuma hatasında yazmak ilerlemeyi silerdi
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return (this.cache = {})
      throw e
    }
    try {
      const raw = JSON.parse(text) as { cards?: Record<string, unknown> }
      const out: Record<string, CardState> = {}
      for (const [id, v] of Object.entries(raw.cards ?? {})) {
        const s = validState(v)
        if (s) out[id] = s
      }
      return (this.cache = out)
    } catch {
      const backup = `${this.file}.corrupt-${this.now().getTime()}`
      await rename(this.file, backup).catch(() => undefined)
      log.warn('srs.json okunamadı, yedeklendi', backup)
      return (this.cache = {})
    }
  }

  private save(): Promise<void> {
    const job = this.chain.then(async () => {
      await mkdir(join(this.file, '..'), { recursive: true })
      await writeAtomic(this.file, JSON.stringify({ version: 1, cards: this.cache ?? {} }, null, 2))
    })
    this.chain = job.catch((e) => log.warn('srs.json yazılamadı', e))
    return job
  }

  async states(): Promise<Record<string, CardState>> {
    return { ...(await this.load()) }
  }

  /** Vadesi gelenler: hiç çalışılmamış kartlar ve vadesi şimdi ya da önce olanlar */
  async due(cards: Card[]): Promise<Card[]> {
    const states = await this.load()
    const t = this.now().getTime()
    return cards.filter((c) => {
      const s = states[c.id]
      return !s || Date.parse(s.due) <= t
    })
  }

  async review(id: string, rating: ReviewRating): Promise<CardState> {
    const states = await this.load()
    const now = this.now()
    const prev = states[id]
    const { card } = this.scheduler.next(prev ? toFsrs(prev) : createEmptyCard(now), now, GRADES[rating])
    const next: CardState = {
      due: card.due.toISOString(),
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsed_days,
      scheduled_days: card.scheduled_days,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state
    }
    if (card.last_review) next.last_review = new Date(card.last_review).toISOString()
    states[id] = next
    await this.save()
    return next
  }

  /** Kasadaki güncel kart listesine göre yetimleri işaretler, 30 günü geçenleri siler */
  async sync(cards: Card[]): Promise<void> {
    const states = await this.load()
    const live = new Set(cards.map((c) => c.id))
    const now = this.now()
    let changed = false
    for (const [id, s] of Object.entries(states)) {
      if (live.has(id)) {
        if (s.orphanSince) {
          delete s.orphanSince
          changed = true
        }
      } else if (!s.orphanSince) {
        s.orphanSince = now.toISOString()
        changed = true
      } else if (now.getTime() - Date.parse(s.orphanSince) > ORPHAN_KEEP_MS) {
        delete states[id]
        changed = true
      }
    }
    if (changed) await this.save()
  }
}
