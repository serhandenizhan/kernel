import { describe, it, expect } from 'vitest'
import { htmlToMarkdown } from '@core/smart-paste/html'
import { convertPaste } from '@core/smart-paste'
import { ARTIFACT_HTML } from '../../../fixtures/paste/artifact'

const OPTS = { latexLineHeuristic: true, stripCitations: true, unfencedCodeHeuristic: true }
const md = () => htmlToMarkdown(ARTIFACT_HTML)!

describe('Claude artifact yapıştırma', () => {
  it('artifact benzeri HTML düz metne düşmez; başlık ve tablo korunur, stil atılır', () => {
    const out = md()
    expect(out).toContain('# Gezegenler Özeti')
    expect(out).toContain('## Keşif tarihi')
    expect(out).toMatch(/\| Gezegen \| Uydu \|/)
    expect(out).not.toContain('border:1px')
  })
  it('terim listesi "**Terim:** açıklama" maddeleri olur', () => {
    expect(md()).toContain('- **Yörünge:** Bir cismin izlediği yol')
    expect(md()).toContain('- **Perihel:** Güneşe en yakın nokta, `q` ile gösterilir')
  })
  it('zaman çizelgesi yıl–olay maddeleri olur', () => {
    expect(md()).toContain("- **1610:** **Galileo** · Jüpiter'in uyduları")
    expect(md()).toContain('- **1781:** **Herschel** · Uranüs')
  })
  it('formül kutusu satırları korunarak kod bloğu olur', () => {
    expect(md()).toContain('```\nv = 2πr / T\nF = G·m1·m2 / r²\n```')
  })
  it('karar akışı iç içe liste, etiketli kutular "**ETİKET:** metin" olur', () => {
    const out = md()
    expect(out).toContain('- Veri neredeyse sıralı mı?\n  - **EVET:** Insertion sort\n  - **HAYIR:** Devam et')
    expect(out).toContain('- Bellek kısıtlı mı?\n  - **EVET:** Heapsort\n  - **HAYIR:** Mergesort')
    expect(out).toContain('- **KAYALIK:** Merkür, Venüs')
  })
  it('uyarı kutusu başlığıyla birlikte uyarı callout\'u olur', () => {
    const { doc } = convertPaste({ text: 'düz metin', html: ARTIFACT_HTML }, OPTS)
    const callout = doc.content!.find((n) => n.type === 'callout')!
    expect(callout.attrs).toMatchObject({ type: 'warning', title: 'Sık karışanlar' })
    expect(JSON.stringify(callout.content)).toContain('Plüton')
  })
  it('uçtan uca: düzenlenebilir Kernel belgesi (tablo, liste, kod, başlık düğümleri)', () => {
    const { doc } = convertPaste({ text: 'düz metin', html: ARTIFACT_HTML }, OPTS)
    const types = new Set((doc.content ?? []).map((n) => n.type))
    for (const t of ['heading', 'table', 'bulletList', 'codeBlock', 'callout']) expect(types).toContain(t)
  })
  it('sıradan zengin metin (artifact işareti yok) biçimi korunarak Markdown olur', () => {
    expect(htmlToMarkdown('<ul><li>bir</li></ul><p>iki <b>üç</b></p>')).toBe('- bir\n\niki **üç**')
  })
})
