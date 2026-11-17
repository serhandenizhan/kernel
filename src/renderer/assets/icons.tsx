import type { ReactNode } from 'react'

// SF Symbols tarzı ikon seti: 16×16, 1.5 px çizgi, currentColor (spec §18.1)
export const ICON_NAMES = ['home', 'plus', 'doc', 'template', 'grid', 'search', 'settings', 'help', 'pin', 'chevron-down', 'chevron-right', 'download', 'image', 'graph', 'cards', 'sidebar', 'smile', 'cover',
  'grip', 'bold', 'italic', 'underline', 'strike', 'code', 'sigma', 'link', 'highlight', 'text', 'h1', 'h2', 'h3',
  'list', 'list-ordered', 'todo', 'quote', 'toggle', 'code-block', 'duplicate', 'trash', 'turn-into', 'card',
  'row-above', 'row-below', 'col-left', 'col-right', 'row-remove', 'col-remove', 'align-left', 'align-center', 'align-right', 'table-header', 'close', 'arrow-up', 'arrow-down'] as const
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
  sidebar: (
    <>
      <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="2" />
      <path d="M6 3v10" />
    </>
  ),
  smile: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M5.6 9.6a3 3 0 0 0 4.8 0M6 6.4v.1M10 6.4v.1" strokeLinecap="round" />
    </>
  ),
  cover: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="2" />
      <path d="M2.2 7.2h11.6" />
    </>
  ),
  grip: (
    <>
      <circle cx="6" cy="3.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="3.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  bold: <path d="M4.5 2.8h4.2a2.6 2.6 0 0 1 0 5.2H4.5zM4.5 8h4.9a2.6 2.6 0 0 1 0 5.2H4.5z" strokeLinejoin="round" strokeWidth={1.9} />,
  italic: <path d="M6.5 2.8h5M4.5 13.2h5M9.8 2.8 6.2 13.2" strokeLinecap="round" />,
  underline: <path d="M4.5 2.5v4.8a3.5 3.5 0 0 0 7 0V2.5M3.5 14h9" strokeLinecap="round" />,
  strike: <path d="M11.3 4.6c-.5-1.2-1.7-1.9-3.3-1.9-1.9 0-3.2 1-3.2 2.4 0 1 .6 1.7 2 2.1M2.8 8h10.4M4.8 11c.5 1.4 1.8 2.2 3.4 2.2 2 0 3.3-1 3.3-2.5 0-.5-.1-.9-.4-1.2" strokeLinecap="round" />,
  code: <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />,
  sigma: <path d="M12 3H4.2L8.6 8l-4.4 5H12" strokeLinecap="round" strokeLinejoin="round" />,
  link: <path d="M6.8 9.2a2.8 2.8 0 0 0 4 0l2-2a2.8 2.8 0 0 0-4-4l-.8.8M9.2 6.8a2.8 2.8 0 0 0-4 0l-2 2a2.8 2.8 0 0 0 4 4l.8-.8" strokeLinecap="round" />,
  highlight: (
    <>
      <path d="m9.6 2.6 3.8 3.8-5.6 5.6H4v-3.8z" strokeLinejoin="round" />
      <path d="M2 14.2h12" strokeLinecap="round" />
    </>
  ),
  text: <path d="M3 3.5h10M8 3.5v9.5" strokeLinecap="round" />,
  h1: (
    <>
      <path d="M2.5 3.5v9M8 3.5v9M2.5 8H8" strokeLinecap="round" />
      <text x="10.2" y="12.6" fontSize="6.6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">1</text>
    </>
  ),
  h2: (
    <>
      <path d="M2.5 3.5v9M8 3.5v9M2.5 8H8" strokeLinecap="round" />
      <text x="10.2" y="12.6" fontSize="6.6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">2</text>
    </>
  ),
  h3: (
    <>
      <path d="M2.5 3.5v9M8 3.5v9M2.5 8H8" strokeLinecap="round" />
      <text x="10.2" y="12.6" fontSize="6.6" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">3</text>
    </>
  ),
  list: (
    <>
      <circle cx="3" cy="4.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="3" cy="11.5" r="1" fill="currentColor" stroke="none" />
      <path d="M6 4.5h8M6 8h8M6 11.5h8" strokeLinecap="round" />
    </>
  ),
  'list-ordered': (
    <>
      <path d="M6.5 4.5H14M6.5 8H14M6.5 11.5H14" strokeLinecap="round" />
      <text x="1.3" y="6.3" fontSize="5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">1</text>
      <text x="1.3" y="13.3" fontSize="5" fontWeight="700" fill="currentColor" stroke="none" fontFamily="system-ui, sans-serif">2</text>
    </>
  ),
  todo: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
      <path d="m5.3 8.2 1.9 1.9 3.6-3.9" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  quote: <path d="M3.5 3v10M7 5h6M7 8h6M7 11h4" strokeLinecap="round" />,
  toggle: <path d="M3 4.5 5 6.5 7 4.5M9 5.5h5M9 10.5h5M3 10.5h3" strokeLinecap="round" strokeLinejoin="round" />,
  'code-block': (
    <>
      <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="2" />
      <path d="M6 6.5 4.5 8 6 9.5M10 6.5 11.5 8 10 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  duplicate: (
    <>
      <rect x="5" y="5" width="8.5" height="8.5" rx="2" />
      <path d="M11 3.2A1.5 1.5 0 0 0 9.6 2.5H4A1.5 1.5 0 0 0 2.5 4v5.6A1.5 1.5 0 0 0 3.2 11" strokeLinecap="round" />
    </>
  ),
  trash: <path d="M2.8 4.3h10.4M6.3 4.3V2.8h3.4v1.5M4.2 4.3l.7 8.7a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9l.7-8.7M6.7 6.8v4.6M9.3 6.8v4.6" strokeLinecap="round" strokeLinejoin="round" />,
  'turn-into': <path d="M3 5.5h8.5L9 3M13 10.5H4.5L7 13" strokeLinecap="round" strokeLinejoin="round" />,
  card: (
    <>
      <rect x="2" y="3.5" width="12" height="9" rx="2" />
      <path d="M2.2 7h11.6" />
    </>
  ),
  'row-above': (
    <>
      <rect x="2.5" y="8" width="11" height="5.5" rx="1.5" />
      <path d="M8 1.8v4M6 3.8h4" strokeLinecap="round" />
    </>
  ),
  'row-below': (
    <>
      <rect x="2.5" y="2.5" width="11" height="5.5" rx="1.5" />
      <path d="M8 10.2v4M6 12.2h4" strokeLinecap="round" />
    </>
  ),
  'col-left': (
    <>
      <rect x="8" y="2.5" width="5.5" height="11" rx="1.5" />
      <path d="M1.8 8h4M3.8 6v4" strokeLinecap="round" />
    </>
  ),
  'col-right': (
    <>
      <rect x="2.5" y="2.5" width="5.5" height="11" rx="1.5" />
      <path d="M10.2 8h4M12.2 6v4" strokeLinecap="round" />
    </>
  ),
  'row-remove': (
    <>
      <rect x="2.5" y="5.2" width="11" height="5.6" rx="1.5" />
      <path d="m6.3 6.6 3.4 2.8M9.7 6.6 6.3 9.4" strokeLinecap="round" />
    </>
  ),
  'col-remove': (
    <>
      <rect x="5.2" y="2.5" width="5.6" height="11" rx="1.5" />
      <path d="m6.6 6.3 2.8 3.4M9.4 6.3 6.6 9.7" strokeLinecap="round" />
    </>
  ),
  'align-left': <path d="M2.5 4h11M2.5 8h7M2.5 12h9" strokeLinecap="round" />,
  'align-center': <path d="M2.5 4h11M4.5 8h7M3.5 12h9" strokeLinecap="round" />,
  'align-right': <path d="M2.5 4h11M6.5 8h7M4.5 12h9" strokeLinecap="round" />,
  'table-header': (
    <>
      <rect x="2" y="2.5" width="12" height="11" rx="2" />
      <path d="M2.2 6.5h11.6" />
      <path d="M2.4 2.9h11.2v3.4H2.4z" fill="currentColor" stroke="none" opacity="0.35" />
    </>
  ),
  close: <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />,
  'arrow-up': <path d="M8 13V3M4 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />,
  'arrow-down': <path d="M8 3v10M4 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />,
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
