import type { Vault } from './vault/vault'
import { mainT } from './i18n'

// Ana süreçteki açık kasa ve ona bağlı servisler
export const state: { vault: Vault | null; stopWatcher: (() => Promise<void>) | null } = {
  vault: null,
  stopWatcher: null
}

export function requireVault(): Vault {
  if (!state.vault) throw new Error(mainT('err.noVault'))
  return state.vault
}
