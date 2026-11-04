import { useStore } from '../state/store'

// Seçili sayfa; editör Görev 10'da buraya bağlanır
export function PageView() {
  const currentId = useStore((s) => s.currentId)
  if (!currentId) {
    return (
      <div className="empty-state">
        <h2>İlk sayfanı oluştur</h2>
        <span>Ders notlarını sayfalar ve alt sayfalar halinde düzenle.</span>
        <button className="btn primary" onClick={() => void useStore.getState().createPage(null)}>
          Yeni sayfa
        </button>
      </div>
    )
  }
  return <div className="page-placeholder" />
}
