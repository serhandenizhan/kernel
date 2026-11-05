import { useEffect, useState } from 'react'
import type { HomeData, HomeItem } from '@shared/types'
import { formatLongDate, formatRelative } from '@shared/i18n'
import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { useLang, useT } from '../lib/i18n'
import { Icon } from '../assets/icons'
import { PageIcon } from '../shell/PageHeader'
import { createLectureNote } from '../shell/NewMenu'
import { ActivityHeatmap } from './ActivityHeatmap'
import { CourseCard } from './CourseCard'

/** Günün saatine göre selam anahtarı */
function greetingKey(hour: number) {
  return hour >= 5 && hour < 12 ? 'home.morning' : hour >= 12 && hour < 18 ? 'home.day' : hour >= 18 && hour < 22 ? 'home.evening' : 'home.night'
}

function RecentList({ title, items, testid }: { title: string; items: HomeItem[]; testid: string }) {
  const t = useT()
  const lang = useLang()
  return (
    <section className="home-section">
      <h2>{title}</h2>
      <div className="recent-list" data-testid={testid}>
        {items.length === 0 && <div className="recent-empty">{t('home.nothingYet')}</div>}
        {items.map((it) => (
          <button key={it.id} className="recent-row" onClick={() => useStore.getState().openPage(it.id)}>
            <span className="recent-icon">{it.icon ? <PageIcon icon={it.icon} size={16} /> : <Icon name="doc" />}</span>
            <span className="recent-text">
              <span className="recent-title">{it.title}</span>
              {it.parentTitle && <span className="recent-parent">{it.parentTitle}</span>}
            </span>
            {it.at && <span className="recent-when">{formatRelative(new Date(it.at), new Date(), lang)}</span>}
          </button>
        ))}
      </div>
    </section>
  )
}

// Ana sayfa (spec §18.2): kasaya yazılmaz; kayıt, ekleme, silme ve dış değişikliklerle canlı yenilenir
export function HomePage() {
  const t = useT()
  const lang = useLang()
  const [data, setData] = useState<HomeData | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let alive = true
    const load = () =>
      void kernel.home
        .data()
        .then((d) => alive && setData(d))
        .catch(() => undefined)
    load()
    const off = kernel.events.onHomeChanged(load)
    // gece yarısı: selam ve ısı haritası yeni güne geçer
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const n = new Date()
      const next = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 5)
      timer = setTimeout(() => {
        setNow(new Date())
        load()
        schedule()
      }, next.getTime() - n.getTime())
    }
    schedule()
    return () => {
      alive = false
      off()
      clearTimeout(timer)
    }
  }, [])

  if (!data) return <div className="home" data-testid="home" />

  if (data.totalPages === 0) {
    return (
      <div className="home" data-testid="home">
        <div className="home-empty" data-testid="home-empty">
          <h1>{t('home.emptyTitle')}</h1>
          <p>{t('home.emptyBody')}</p>
          <div className="home-actions">
            <button className="home-btn primary" onClick={() => void useStore.getState().createPage(null)}>
              <Icon name="plus" size={14} /> {t('home.newNote')}
            </button>
            <button className="home-btn" onClick={() => useStore.getState().setOverlay('notion')}>
              <Icon name="download" size={14} /> {t('home.emptyNotion')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const notes = data.totalPages - data.courses.length
  return (
    <div className="home" data-testid="home">
      <div className="home-column">
        <header className="home-header">
          <p className="home-date">{formatLongDate(now, lang)}</p>
          <h1>{t(greetingKey(now.getHours()))}</h1>
          <div className="home-actions">
            <button className="home-search" data-testid="home-search" onClick={() => useStore.getState().setOverlay('search')}>
              <Icon name="search" />
              <span>{t('home.search')}</span>
              <kbd>⌘K</kbd>
            </button>
            <button className="home-btn primary" data-testid="home-new" onClick={() => void useStore.getState().createPage(null)}>
              <Icon name="plus" size={14} /> {t('home.newNote')}
            </button>
            <button className="home-btn" data-testid="home-lecture" onClick={() => void createLectureNote()}>
              <Icon name="template" size={15} /> {t('home.lecture')}
            </button>
          </div>
        </header>

        <section className="home-section">
          <div className="home-section-head">
            <h2>{t('home.activity')}</h2>
            <span>{t('home.last12')}</span>
          </div>
          <ActivityHeatmap days={data.activity} />
        </section>

        {data.pins.length > 0 && (
          <section className="home-section">
            <h2>{t('home.pinned')}</h2>
            <div className="home-pins">
              {data.pins.map((p) => (
                <button key={p.id} className="home-pin" data-testid="home-pin" onClick={() => useStore.getState().openPage(p.id)}>
                  <span className="home-pin-icon">{p.icon ? <PageIcon icon={p.icon} size={20} /> : <Icon name="doc" size={18} />}</span>
                  <span className="recent-text">
                    <span className="recent-title">{p.title}</span>
                    {p.parentTitle && <span className="recent-parent">{p.parentTitle}</span>}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="home-section">
          <div className="home-section-head">
            <h2>{t('home.courses')}</h2>
            <span>{t('home.coursesCount', { courses: data.courses.length, notes })}</span>
          </div>
          <div className="course-grid">
            {data.courses.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        </section>

        <div className="home-two">
          <RecentList title={t('home.recentEdited')} items={data.recentEdited} testid="home-recent-edited" />
          <RecentList title={t('home.recentAdded')} items={data.recentAdded} testid="home-recent-added" />
        </div>
      </div>
    </div>
  )
}
