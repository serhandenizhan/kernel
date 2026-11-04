import type { Vault } from './vault/vault'

// Ana süreçteki açık kasa ve ona bağlı servisler
export const state: { vault: Vault | null; stopWatcher: (() => Promise<void>) | null } = {
  vault: null,
  stopWatcher: null
}

export function requireVault(): Vault {
  if (!state.vault) throw new Error('Açık kasa yok')
  return state.vault
}
