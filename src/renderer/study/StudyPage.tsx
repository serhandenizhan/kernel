import { useCallback, useEffect, useMemo, useState } from 'react'
import katex from 'katex'
import type { Deck, DeckInfo, ReviewRating, StudyCard } from '@shared/types'
import { toVaultUrl } from '@core/vault-url'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { useT, useTn } from '../lib/i18n'

const RATINGS: { id: ReviewRating; key: string; label: 'study.again' | 'study.hard' | 'study.good' | 'study.easy' }[] = [
  { id: 'again', key: '1', label: 'study.again' },
  { id: 'hard', key: '2', label: 'study.hard' },
  { id: 'good', key: '3', label: 'study.good' },
  { id: 'easy', key: '4', label: 'study.easy' }
]

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Kart metni: $$…$$ / $…$ formüller KaTeX ile, ![](attachments/…) görseller, gerisi kaçışlı düz metin */
export function cardHtml(md: string): string {
  const parts: string[] = []
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|!\[[^\]]*\]\((attachments\/[^)\s|]+)[^)]*\)|`([^`]+)`/g
  let last = 0
  for (const m of md.matchAll(re)) {
    parts.push(escapeHtml(md.slice(last, m.index)))
    if (m[1] !== undefined) parts.push(katex.renderToString(m[1], { throwOnError: false, displayMode: true }))
    else if (m[2] !== undefined) parts.push(katex.renderToString(m[2], { throwOnError: false }))
    else if (m[3] !== undefined) parts.push(`<img src="${escapeHtml(toVaultUrl(m[3]))}" alt="">`)
    else parts.push(`<code>${escapeHtml(m[4]!)}</code>`)
    last = m.index! + m[0].length
  }
  parts.push(escapeHtml(md.slice(last)))
  return parts.join('').replace(/\n/g, '<br>')
}

function Session({ deck, exam, title, onExit }: { deck: Deck; exam: boolean; title: string; onExit(): void }) {
  const t = useT()
  const [cards, setCards] = useState<StudyCard[] | null>(null)
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    void kernel.study.session(deck, exam).then(setCards)
  }, [deck, exam])

  const card = cards?.[index]
  const rate = useCallback(
    async (r: ReviewRating) => {
      if (!card) return
      // sınav modu vadeleri değiştirmez: yalnızca kendini sınama
      if (!exam) await kernel.study.review(card.id, r)
      setShown(false)
      setIndex((i) => i + 1)
    },
    [card, exam]
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !card) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!shown) setShown(true)
        else void rate('good')
      } else if (shown) {
        const r = RATINGS.find((x) => x.key === e.key)
        if (r) {
          e.preventDefault()
          void rate(r.id)
        }
      } else if (e.key === 'Escape') onExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, shown, rate, onExit])

  if (!cards) return null
  return (
    <div className="study-session">
      <header className="study-session-bar">
        <button className="ghost-btn" data-testid="study-back" onClick={onExit}>
          ‹ {t('study.decks')}
        </button>
        <span className="study-deck-name">
          {title}
          {exam && <span className="study-exam-badge">{t('study.exam')}</span>}
        </span>
        {card && (
          <span className="study-progress" data-testid="study-progress">
            {index + 1} / {cards.length}
          </span>
        )}
      </header>
      {!card ? (
        <div className="study-done" data-testid="study-done">
          <h2>{cards.length === 0 ? t('study.nothingDue') : t('study.doneTitle')}</h2>
          <p>{t('study.doneBody')}</p>
          <button className="home-btn primary" onClick={onExit}>
            {t('study.decks')}
          </button>
        </div>
      ) : (
        <div className="study-card glass" key={card.id}>
          <div className="card-question" data-testid="card-question" dangerouslySetInnerHTML={{ __html: cardHtml(card.question) }} />
          {shown ? (
            <>
              <div className="card-divider" />
              <div className="card-answer" data-testid="card-answer" dangerouslySetInnerHTML={{ __html: cardHtml(card.answer) }} />
              <div className="card-ratings">
                {RATINGS.map((r) => (
                  <button key={r.id} className={`rate-btn rate-${r.id}`} data-testid={`rate-${r.id}`} onClick={() => void rate(r.id)}>
                    <span>{t(r.label)}</span>
                    <kbd>{r.key}</kbd>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button className="home-btn primary card-show" data-testid="card-show" onClick={() => setShown(true)}>
              {t('study.show')} <kbd>␣</kbd>
            </button>
          )}
          <button className="card-source" onClick={() => useStore.getState().openPage(card.pageId)}>
            {t('study.openPage')}
          </button>
        </div>
      )}
    </div>
  )
}

// Çalışma ekranı (spec §12): deste seçimi, vadesi gelenler, Tekrar/Zor/İyi/Kolay, sınav modu
export function StudyPage() {
  const t = useT()
  const tn = useTn()
  const [decks, setDecks] = useState<DeckInfo[] | null>(null)
  const [active, setActive] = useState<{ info: DeckInfo; exam: boolean } | null>(null)
  const initial = useStore((s) => s.studyDeck)

  const load = useCallback(() => void kernel.study.decks().then(setDecks), [])
  useEffect(() => {
    load()
    const off = kernel.events.onLinksChanged(load)
    return off
  }, [load])

  // ana sayfadan "Başla" ile gelindiyse doğrudan o deste açılır
  useEffect(() => {
    if (initial && decks && !active) {
      const info = decks.find((d) => JSON.stringify(d.deck) === JSON.stringify(initial))
      if (info) setActive({ info, exam: false })
      useStore.setState({ studyDeck: null })
    }
  }, [initial, decks, active])

  const exit = useCallback(() => {
    setActive(null)
    load()
  }, [load])
  const deckKey = useMemo(() => (active ? JSON.stringify(active.info.deck) : ''), [active])

  if (active) return <Session key={`${deckKey}:${active.exam}`} deck={active.info.deck} exam={active.exam} title={active.info.title} onExit={exit} />
  return (
    <div className="study-page" data-testid="study-page">
      <div className="home-column">
        <header className="home-header">
          <h1>{t('study.title')}</h1>
          <p className="study-hint">{t('study.hint')}</p>
        </header>
        {decks && decks[0]?.total === 0 ? (
          <p className="recent-empty" data-testid="study-empty">
            {t('study.noCards')}
          </p>
        ) : (
          <div className="deck-list">
            {decks?.map((d) => (
              <div key={JSON.stringify(d.deck)} className="deck-row" data-testid="deck-row">
                <span className="deck-text">
                  <span className="deck-title">{d.title}</span>
                  <span className="deck-meta">{tn('study.cardCount', d.total)}</span>
                </span>
                <span className={`deck-due${d.due ? ' has-due' : ''}`} title={t('study.dueLabel')}>
                  {d.due}
                </span>
                <button className="home-btn primary" data-testid="deck-study" disabled={d.due === 0} onClick={() => setActive({ info: d, exam: false })}>
                  {t('study.start')}
                </button>
                <button className="home-btn" data-testid="deck-exam" disabled={d.total === 0} onClick={() => setActive({ info: d, exam: true })}>
                  {t('study.exam')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
