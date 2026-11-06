import { describe, expect, it } from 'vitest'
import { releaseNotes } from '@core/release-notes'

const GENERATED = `## What's Changed
* feat: charts and diagrams by @someone in https://github.com/serhandenizhan/kernel/pull/3
* fix: palette stays on screen by @someone in https://github.com/serhandenizhan/kernel/pull/4

## New Contributors
* @someone made their first contribution in https://github.com/serhandenizhan/kernel/pull/3

**Full Changelog**: https://github.com/serhandenizhan/kernel/compare/v0.5.1...v0.6.0`

describe('releaseNotes', () => {
  it('GitHub otomatik notundan teknik satırları atar, maddeleri sadeleştirir', () => {
    expect(releaseNotes(GENERATED, 'tr')).toEqual([
      { kind: 'item', text: 'Charts and diagrams' },
      { kind: 'item', text: 'Palette stays on screen' }
    ])
  })
  it('dil bölümleri varsa arayüz dilindekini seçer; yoksa İngilizce, o da yoksa Türkçe', () => {
    const body = '<!-- tr -->\n### Yeni\n- Kartlar artık görünüyor\n<!-- en -->\n### New\n- Cards are visible now\n'
    expect(releaseNotes(body, 'tr')).toEqual([
      { kind: 'heading', text: 'Yeni' },
      { kind: 'item', text: 'Kartlar artık görünüyor' }
    ])
    expect(releaseNotes(body, 'de')).toEqual([
      { kind: 'heading', text: 'New' },
      { kind: 'item', text: 'Cards are visible now' }
    ])
    expect(releaseNotes('<!-- tr -->\n- Yalnız Türkçe\n', 'en')).toEqual([{ kind: 'item', text: 'Yalnız Türkçe' }])
  })
  it('kalın / kod / link işaretlerini düz metne çevirir; düz paragraf korunur', () => {
    expect(releaseNotes('Bu sürümde **iki** yenilik var: `kart` ve [güncelleme](https://example.com).', 'tr')).toEqual([
      { kind: 'text', text: 'Bu sürümde iki yenilik var: kart ve güncelleme.' }
    ])
  })
  it('boş not boş liste', () => {
    expect(releaseNotes('  \n', 'tr')).toEqual([])
  })
})
