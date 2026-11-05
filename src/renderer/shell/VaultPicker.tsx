import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
import { tNow } from '../lib/i18n'
import logo from '../assets/logo.svg'

// Kasa yokken (ilk açılış ya da kayıtlı klasör bulunamadığında) gösterilir
export function VaultPicker() {
  const choose = async (create: boolean) => {
    const res = await kernel.vault.choose(create)
    if (res) await useStore.getState().init()
  }
  return (
    <div className="vault-picker" data-testid="vault-picker">
      <img src={logo} width={88} height={88} alt="" />
      <h1>{tNow('vault.welcome')}</h1>
      <p>{tNow('vault.intro')}</p>
      <button className="btn primary" onClick={() => void choose(true)}>
        {tNow('vault.create')}
      </button>
      <button className="btn" onClick={() => void choose(false)}>
        {tNow('vault.choose')}
      </button>
    </div>
  )
}
