import { kernel } from '../lib/kernel'
import { useStore } from '../state/store'
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
      <h1>Kernel'e hoş geldin</h1>
      <p>Notların, bilgisayarında senin seçtiğin bir klasörde düz Markdown dosyaları olarak durur. Önerilen yer: Belgeler/Kernel.</p>
      <button className="btn primary" onClick={() => void choose(true)}>
        Kernel kasası oluştur
      </button>
      <button className="btn" onClick={() => void choose(false)}>
        Mevcut bir klasörü seç
      </button>
    </div>
  )
}
