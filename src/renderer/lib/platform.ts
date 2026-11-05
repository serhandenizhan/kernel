import { isModKey, keyLabel } from '@core/keys'
import { kernel } from './kernel'

// macOS'ta ⌘, Windows / Linux'ta Ctrl birincil değiştirici tuştur
export const isMac = (kernel.app.platform ?? 'darwin') === 'darwin'

/** Kısayolun birincil değiştiricisi basılı mı (Mac: ⌘, diğerleri: Ctrl) */
export const modKey = (e: { metaKey: boolean; ctrlKey: boolean; altKey: boolean }): boolean => isModKey(e, isMac)

/** "⌘⇧F" gibi etiketi bu platformda gösterilecek biçime çevirir */
export const keys = (label: string): string => keyLabel(label, isMac)
