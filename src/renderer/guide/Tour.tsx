import { useState } from 'react'
import { useStore } from '../state/store'
import { TIPS, useTip } from './tips'
import logo from '../assets/logo.svg'

const CARDS = [
  { title: 'Notların senin', body: 'Her sayfa, bilgisayarındaki kasa klasöründe düz bir Markdown dosyası. Kernel kapansa bile notlarını her editörde açabilirsin.', visual: '📁' },
  { title: 'Akıllı yapıştırma', body: 'NotebookLM, ChatGPT ya da Claude’dan kopyaladığın metni yapıştır: formüller ve kod blokları kendiliğinden düzelir.', visual: '∑' },
  { title: '/ ile her blok', body: 'Satır başında / yaz: başlık, liste, formül, kod, tablo, callout, toggle… Türkçe karakter yazmadan da bulursun.', visual: '/' },
  { title: '⌘K ile her şeyi bul', body: 'Sayfa adları ve tüm içerik içinde anında arama. Son açtığın sayfalar da burada.', visual: '⌘K' },
  { title: 'Kaymayan PDF', body: '⌘E ile sayfanı PDF’e çevir: metin ve formüller vektörel, görseller tam çözünürlükte kalır.', visual: 'PDF' }
]

// İlk açılış turu (cam pencere)
export function Tour() {
  const [i, setI] = useState(0)
  const finish = () => void useStore.getState().setSettings({ tourDone: true })
  const card = CARDS[i]!
  return (
    <div className="modal-backdrop tour-backdrop">
      <div className="tour glass" data-testid="tour" role="dialog" aria-label="Kernel tanıtımı">
        <div className="tour-visual">{i === 0 ? <img src={logo} width={64} height={64} alt="" /> : <span>{card.visual}</span>}</div>
        <h3>{card.title}</h3>
        <p>{card.body}</p>
        <div className="tour-dots">
          {CARDS.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn" data-testid="tour-skip" onClick={finish}>
            Atla
          </button>
          {i < CARDS.length - 1 ? (
            <button className="btn primary" data-testid="tour-next" onClick={() => setI(i + 1)}>
              İleri
            </button>
          ) : (
            <button className="btn primary" data-testid="tour-next" onClick={finish}>
              Başla
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Tek seferlik ipucu baloncuğu
export function TipBubble() {
  const current = useTip((s) => s.current)
  if (!current) return null
  const tip = TIPS[current]
  return (
    <div className="tip glass" data-testid="tip" role="status">
      <div className="tip-head">
        <strong>{tip.title}</strong>
        <button className="icon-btn" data-testid="tip-close" aria-label="Kapat" onClick={() => useTip.setState({ current: null })}>
          ×
        </button>
      </div>
      <p>{tip.body}</p>
    </div>
  )
}
