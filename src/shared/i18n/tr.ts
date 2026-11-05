import { MESSAGES } from './messages'

type Keys = keyof typeof MESSAGES
const pick = (i: 0 | 1 | 2) => Object.fromEntries(Object.entries(MESSAGES).map(([k, v]) => [k, v[i]])) as Record<Keys, string>

// Türkçe sözlük: kaynak dil
export const tr: Record<Keys, string> = pick(0)
export const _pick = pick
