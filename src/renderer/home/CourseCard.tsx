import type { HomeCourse } from '@shared/types'
import { formatRelative } from '@shared/i18n'
import { coverCss } from '../assets/covers'
import { toVaultUrl } from '@core/vault-url'
import { useLang, useT, useTn } from '../lib/i18n'
import { useStore } from '../state/store'
import { PageIcon } from '../shell/PageHeader'

// kapağı olmayan derse başlığından türeyen yumuşak bir degrade (her açılışta aynı)
function placeholder(title: string): string {
  let h = 0
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)!) % 360
  return `linear-gradient(135deg, hsl(${h} 45% 42%), hsl(${(h + 50) % 360} 50% 52%))`
}

export function CourseCard({ course }: { course: HomeCourse }) {
  const t = useT()
  const tn = useTn()
  const lang = useLang()
  const cover = coverCss(course.cover, toVaultUrl) ?? placeholder(course.title)
  const sub = course.descendantCount ? tn('common.subpages', course.descendantCount) : t('home.noSubpages')
  const when = course.lastUpdated ? ` · ${formatRelative(new Date(course.lastUpdated), new Date(), lang)}` : ''
  return (
    <button className="course-card" data-testid="home-course" onClick={() => useStore.getState().openPage(course.id)}>
      <span className="course-cover" style={{ background: cover }}>
        {course.icon && (
          <span className="course-icon">
            <PageIcon icon={course.icon} size={22} />
          </span>
        )}
      </span>
      <span className="course-body">
        <span className="course-title">{course.title}</span>
        <span className="course-meta">
          {sub}
          {when}
        </span>
      </span>
    </button>
  )
}
