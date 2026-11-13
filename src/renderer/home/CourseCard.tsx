import type { HomeCourse } from '@shared/types'
import { formatRelative } from '@shared/i18n'
import { coverCss } from '../assets/covers'
import { toVaultUrl } from '@core/vault-url'
import { useLang, useT, useTn } from '../lib/i18n'
import { useStore } from '../state/store'
import { PageIcon } from '../shell/PageHeader'

// kapağı olmayan derse başlığından türeyen sakin bir degrade (her açılışta aynı).
// Tonlar uygulamanın yeşil-mavi paletinden seçilir; rastgele mor/pembe çıkmaz.
const PLACEHOLDER_HUES = [168, 186, 198, 150, 138, 176]
function placeholder(title: string): string {
  let n = 0
  for (const ch of title) n = (n * 31 + ch.codePointAt(0)!) % 9973
  const h = PLACEHOLDER_HUES[n % PLACEHOLDER_HUES.length]!
  return `linear-gradient(135deg, hsl(${h} 30% 40%), hsl(${(h + 18) % 360} 32% 56%))`
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
