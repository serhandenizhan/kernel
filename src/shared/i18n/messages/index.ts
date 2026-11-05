import { common } from './common'
import { settings } from './settings'
import { notion } from './notion'
import { exportMessages } from './export'
import { shell } from './shell'
import { editor } from './editor'
import { guide } from './guide'

// Tüm bölümler: her anahtar [Türkçe, English, Deutsch] üçlüsü (eksik dil yapısal olarak imkânsız)
export const MESSAGES = {
  ...common,
  ...settings,
  ...notion,
  ...exportMessages,
  ...shell,
  ...editor,
  ...guide
} as const
