import type { ReactNode } from 'react'

// SF Symbols tarzı ikon seti: 16×16, 1.5 px çizgi, currentColor (spec §18.1)
export const ICON_NAMES = ['home', 'plus', 'doc', 'template', 'grid', 'search', 'settings', 'help', 'pin', 'chevron-down', 'chevron-right', 'download', 'image', 'graph', 'cards'] as const
export type IconName = (typeof ICON_NAMES)[number]

const PATHS: Record<IconName, ReactNode> = {
  home: <path d="M2.5 7.2 8 2.8l5.5 4.4V13a.8.8 0 0 1-.8.8H9.8V10H6.2v3.8H3.3a.8.8 0 0 1-.8-.8z" strokeLinejoin="round" />,
  plus: <path d="M8 3v10M3 8h10" strokeLinecap="round" />,
  doc: <path d="M4 1.8h5.2L12 4.6V14a.6.6 0 0 1-.6.6H4a.6.6 0 0 1-.6-.6V2.4a.6.6 0 0 1 .6-.6zM9 1.9v2.9h2.9" strokeLinejoin="round" />,
  template: (
    <>
      <rect x="3" y="2" width="10" height="12" rx="2" />
      <path d="M6 6h4M6 9h4" strokeLinecap="round" />
    </>
  ),
  grid: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" />
      <rect x="9" y="9" width="5" height="5" rx="1.2" />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3.2 3.2" strokeLinecap="round" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" strokeLinecap="round" />
    </>
  ),
  help: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.2v.1" strokeLinecap="round" />
    </>
  ),
  pin: <path d="M6 2h4l-.6 3.6L12 7.5H4l2.6-1.9zM8 7.5V14" strokeLinejoin="round" strokeLinecap="round" />,
  'chevron-down': <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  'chevron-right': <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />,
  download: <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13.5h10" strokeLinecap="round" strokeLinejoin="round" />,
  cards: (
    <>
      <rect x="2.5" y="4" width="9" height="10" rx="1.6" />
      <path d="M5 2h6.9A1.6 1.6 0 0 1 13.5 3.6V11" strokeLinecap="round" />
    </>
  ),
  graph: (
    <>
      <circle cx="4" cy="4.5" r="1.8" />
      <circle cx="12" cy="6" r="1.8" />
      <circle cx="6.5" cy="12" r="1.8" />
      <path d="M5.7 5 10.3 5.6M11 7.5 7.6 10.6M4.5 6.2l1.4 4" strokeLinecap="round" />
    </>
  ),
  image: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <circle cx="6" cy="6.8" r="1.2" />
      <path d="m2.8 12.2 3.7-3.7 2.6 2.6 1.7-1.7 2.4 2.4" strokeLinejoin="round" />
    </>
  )
}

/** İkon; `title` verilmezse dekoratiftir (ekran okuyucu atlar) */
export function Icon({ name, size = 16, title }: { name: IconName; size?: number; title?: string }) {
  const a11y = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true as const }
  return (
    <svg className={`icon icon-${name}`} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} {...a11y}>
      {PATHS[name]}
    </svg>
  )
}
