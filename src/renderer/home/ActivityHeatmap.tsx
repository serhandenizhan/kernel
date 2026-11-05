import { formatLongDate } from '@shared/i18n'
import { useLang, useT, useTn } from '../lib/i18n'

/** Etkinlik sayısını 0–4 basamağa çevirir (0: yok) */
export function level(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0
  if (max <= 1) return 4
  const r = count / max
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1
}

// 12 haftalık ısı haritası: sütunlar hafta, satırlar gün (eskiden yeniye)
export function ActivityHeatmap({ days }: { days: { day: string; count: number }[] }) {
  const t = useT()
  const tn = useTn()
  const lang = useLang()
  const max = Math.max(1, ...days.map((d) => d.count))
  const label = (day: string) => {
    const [y, m, d] = day.split('-').map(Number) as [number, number, number]
    return formatLongDate(new Date(y, m - 1, d), lang)
  }
  return (
    <div className="heatmap-wrap">
      <div className="heatmap" data-testid="home-heatmap" role="img" aria-label={t('home.activity')}>
        {days.map((d) => (
          <span key={d.day} className={`heat-cell l${level(d.count, max)}`} data-count={d.count} title={tn('home.cellPages', d.count, { date: label(d.day) })} />
        ))}
      </div>
      <div className="heat-legend" aria-hidden="true">
        <span>{t('home.less')}</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`heat-cell l${l}`} />
        ))}
        <span>{t('home.more')}</span>
      </div>
    </div>
  )
}
