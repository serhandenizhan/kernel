# Kernel Faz 3: Yeni görünüm, ana sayfa ve diller — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kernel'e yeni bir görünüm (yazı alanında degrade, saydam kenar çubuğu, SF Pro yazı tipleri, ikon seti, ikonlu sayfa linkleri), canlı güncellenen bir ana sayfa ve Türkçe / İngilizce / Almanca arayüz eklemek.

**Architecture:** Görünüm CSS token'ları ve birkaç yeniden yazılan kabuk bileşeniyle değişir; kasa formatı aynı kalır. Ana sayfa verisi ana süreçte saf bir `computeHome` fonksiyonuyla hesaplanır, tek IPC çağrısıyla gelir ve `home.changed` olayıyla canlı yenilenir. Diller paylaşılan tipli sözlüklerle (`src/shared/i18n`) yapılır; renderer ve main aynı `t()` fonksiyonunu kullanır.

**Tech Stack:** Electron 45, React 19, TypeScript 7, TipTap 3, Zustand, Vitest, Playwright (Electron), `Intl` (tarih ve çoğul).

**Spec:** `docs/superpowers/specs/2026-11-04-kernel-design.md` §18 (ve §5, §13). Mockup'lar: https://claude.ai/artifact/NjjDgxaX8QSSMuXeGWPkUs (kullanıcı onayladı; kapak degradesi değil, yazı alanı degradesi, ısı haritası en üstte).

**Dal:** `main`'den `phase-3-redesign`.

## Global Constraints

- Kod ve tanımlayıcılar İngilizce, **yorumlar Türkçe**. Arayüz metinleri `src/shared/i18n` sözlüklerinden gelir; Türkçe kaynak dildir.
- Kasa formatı değişmez. Yeni dosyalar yalnızca `.kernel/` altına: `pins.json`, `activity.json`.
- Güvenlik: contextIsolation, sandbox açık; renderer diske yalnızca `window.kernel` ile erişir.
- `src/core/` ve `src/shared/` saf modüllerdir (Electron/DOM yok), Node'da test edilir.
- TDD: önce başarısız test, sonra kod. Her commit öncesi `npm run check:private` temiz olmalı.
- Testler yalnızca geçici kasa (`KERNEL_VAULT`) ve geçici userData kullanır. Test verileri sıfırdan yazılır; kullanıcı notlarından satır alınmaz.
- Metin kontrastı her iki temada WCAG AA (4.5:1). "Saydamlığı azalt" → düz zemin; "Hareketi azalt" → animasyon yok.
- Aurora, degrade ve cam efektleri PDF'e ve HTML export'a girmez.
- Push yalnızca kullanıcı onayıyla.

## Review Focus

1. **Uzun sayfada degrade:** 3000 px'lik bir notta aşağı kaydırınca metnin arkası koyulaşmamalı (degrade pencereye sabit). Test: Task 6.
2. **Almanca taşma:** Almanca uzun etiketler kenar çubuğunda, ayarlarda ve "Yeni" menüsünde taşmamalı, kesilip `…` ile bitmeli. Test: Task 5 (ekran görüntüsü ve `scrollWidth <= clientWidth` kontrolü).
3. **Silinen ya da taşınan sabitlenmiş sayfa:** Sabitlenen sayfa çöpe atılınca ya da taşınınca ana sayfa ve kenar çubuğu çökmemeli; silinen düşmeli, taşınan kalmalı. Test: Task 9.
4. **Gece yarısı ve saat dilimi:** Etkinlik günü yerel tarihe göre sayılmalı (UTC değil). 23:30'da yapılan düzenleme o güne yazılmalı. Test: Task 10.
5. **Hedefi olmayan ve aynı adlı sayfa linkleri:** İkon araması yol ile çözülen (`[[NLP/Graphs]]`) ve hiç çözülmeyen linklerde çökmemeli; çözülmeyende soluk stil. Test: Task 13.

---

### Task 1: Ayar şeması 2 (dil, açılış görünümü, SF Pro varsayılanı)

**Files:**
- Modify: `src/shared/types.ts` (Settings, DEFAULT_SETTINGS)
- Modify: `src/main/vault/settings.ts`
- Modify: `test/e2e/helpers/app.ts`
- Test: `test/unit/main/vault/settings.test.ts` (yoksa oluştur)

**Interfaces:**
- Produces: `type Lang = 'tr' | 'en' | 'de'`; `Settings` eklenen alanlar `language: Lang | 'system'`, `startView: 'home' | 'last'`, `schema: number`; varsayılanlar `bodyFont: 'sans'`, `language: 'system'`, `startView: 'home'`, `schema: 2`.
- Produces: `readSettings(root)` şeması 2'den eski dosyayı göç ettirip döndürür ve diske yazar.
- Produces: `LaunchOptions.home?: boolean`. e2e yardımcısı yeni ayar dosyasına varsayılan olarak `startView: 'last'` yazar (mevcut testler değişmesin); `home: true` ise yazmaz.

- [ ] **Step 1: Başarısız testleri yaz**

```ts
it('şeması olmayan eski ayar bir kerelik SF Pro\'ya geçer ve diske yazılır', async () => {
  writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ bodyFont: 'serif', theme: 'dark' }))
  const s = await readSettings(root)
  expect(s).toMatchObject({ bodyFont: 'sans', theme: 'dark', schema: 2, language: 'system', startView: 'home' })
  expect(JSON.parse(readFileSync(join(root, '.kernel', 'settings.json'), 'utf8')).schema).toBe(2)
})
it('şema 2\'de kullanıcının serif seçimi korunur', async () => {
  writeFileSync(join(root, '.kernel', 'settings.json'), JSON.stringify({ bodyFont: 'serif', schema: 2 }))
  expect((await readSettings(root)).bodyFont).toBe('serif')
})
it('ayar dosyası yoksa varsayılanlar (göç yazımı yapılmaz)', async () => {
  expect(await readSettings(root)).toMatchObject({ bodyFont: 'sans', schema: 2 })
  expect(existsSync(join(root, '.kernel', 'settings.json'))).toBe(false)
})
```

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör**

Run: `npx vitest run test/unit/main/vault/settings.test.ts`
Expected: FAIL (`schema` yok, `bodyFont` 'serif')

- [ ] **Step 3: Uygula.** Ayar dosyası okunabiliyor ve `schema` 2'den küçükse (ya da yoksa): `bodyFont = 'sans'`, `schema = 2` yap ve `writeAtomic` ile yaz. Yardımcıda ayar nesnesine `startView: 'last'` ekle (`opts.home` değilse).

- [ ] **Step 4: Testleri ve tüm birim takımını çalıştır**

Run: `npx vitest run test/unit/main/vault/settings.test.ts && npm test`
Expected: PASS

- [ ] **Step 5: Commit** — `feat(settings): schema 2 with language, start view and SF Pro default`

---

### Task 2: i18n çekirdeği

**Files:**
- Create: `src/shared/i18n/index.ts`, `src/shared/i18n/tr.ts`, `src/shared/i18n/en.ts`, `src/shared/i18n/de.ts`
- Create: `src/renderer/lib/i18n.ts`, `src/main/i18n.ts`
- Modify: `src/shared/types.ts` (KernelApi `app.locale(): Promise<string>`), `src/shared/ipc.ts`, `src/preload/index.ts`, `src/main/ipc-handlers.ts`
- Test: `test/unit/shared/i18n.test.ts`

**Interfaces:**
- Produces (`src/shared/i18n/index.ts`):
  - `type MessageKey = keyof typeof tr`; `en` ve `de` tipleri `Record<MessageKey, string>`.
  - `t(lang: Lang, key: MessageKey, params?: Record<string, string | number>): string`. `{name}` yer tutucuları doldurulur. Eksik çeviri olursa Türkçeye düşer.
  - `tn(lang: Lang, key: MessageKey, count: number): string`. Çoğul anahtarlar `key.one` / `key.other` biçimindedir; `Intl.PluralRules` ile seçilir, `{count}` doldurulur.
  - `resolveLang(setting: Lang | 'system', systemLocale: string): Lang`. `de-*` → 'de', `en-*` → 'en', `tr-*` → 'tr', diğerleri → 'tr'.
  - `formatRelative(date: Date, now: Date, lang: Lang): string`. `Intl.RelativeTimeFormat` ve `numeric: 'auto'` kullanır: dakika, saat, dün/bugün, gün, hafta, ay.
  - `formatLongDate(date: Date, lang: Lang): string`. Örnek: tr → "Perşembe, 5 Kasım 2026".
- Produces (renderer): `useT(): (key: MessageKey, params?) => string`, `useTn()`, `tNow(key, params?)` (React dışı, store'daki dili okur), `useLang(): Lang`. Sistem dili açılışta `kernel.app.locale()` ile bir kez alınıp store'a yazılır.
- Produces (main): `mainT(key, params?)`, `mainLang(): Lang` (geçerli ayar + `app.getLocale()`).
- Başlangıç sözlüğü bu task'ta yalnızca test anahtarlarını ve `common.*` anahtarlarını içerir; diğer anahtarlar Task 3–4'te eklenir.

- [ ] **Step 1: Başarısız testleri yaz**

```ts
it('üç dilin anahtar kümeleri aynı ve boş çeviri yok', () => {
  const keys = Object.keys(tr).sort()
  expect(Object.keys(en).sort()).toEqual(keys)
  expect(Object.keys(de).sort()).toEqual(keys)
  for (const d of [tr, en, de]) for (const v of Object.values(d)) expect(v.trim()).not.toBe('')
})
it('yer tutucular her dilde aynı', () => {
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
  for (const k of Object.keys(tr) as MessageKey[]) { expect(ph(en[k])).toBe(ph(tr[k])); expect(ph(de[k])).toBe(ph(tr[k])) }
})
it('t ve tn', () => {
  expect(t('tr', 'common.subpages.other' as MessageKey, { count: 5 })).toBe('5 alt sayfa')
  expect(tn('en', 'common.subpages', 1)).toBe('1 subpage')
  expect(tn('de', 'common.subpages', 3)).toBe('3 Unterseiten')
})
it('resolveLang', () => {
  expect(resolveLang('system', 'de-AT')).toBe('de'); expect(resolveLang('system', 'fr-FR')).toBe('tr'); expect(resolveLang('en', 'tr-TR')).toBe('en')
})
it('tarih biçimleri', () => {
  const now = new Date(2026, 10, 5, 18, 0)
  expect(formatLongDate(now, 'tr')).toBe('Perşembe, 5 Kasım 2026')
  expect(formatRelative(new Date(2026, 10, 5, 16, 0), now, 'tr')).toBe('2 saat önce')
  expect(formatRelative(new Date(2026, 10, 4, 12, 0), now, 'tr')).toBe('dün')
  expect(formatRelative(new Date(2026, 10, 4, 12, 0), now, 'en')).toBe('yesterday')
})
```

- [ ] **Step 2: Çalıştır, başarısız olduğunu gör** — `npx vitest run test/unit/shared/i18n.test.ts` → FAIL (modül yok)
- [ ] **Step 3: Uygula** (yukarıdaki imzalar; `common.subpages.one/other` tr: "{count} alt sayfa" / "{count} alt sayfa", en: "{count} subpage" / "{count} subpages", de: "{count} Unterseite" / "{count} Unterseiten").
- [ ] **Step 4: Testler + typecheck** — `npx vitest run test/unit/shared/i18n.test.ts && npm run typecheck` → PASS
- [ ] **Step 5: Commit** — `feat(i18n): typed dictionaries, plural and date helpers`

---

### Task 3: Renderer metinlerini sözlüğe taşı ve sabit metin denetimi

**Files:**
- Create: `scripts/check-i18n.mjs` (+ `scripts/check-i18n.d.mts`), `scripts/i18n-allow.txt`
- Modify: `package.json` (script `check:i18n`)
- Modify: `src/renderer/**/*.tsx|ts`: tüm arayüz metinleri `useT()` / `tNow()` kullanır. Kapsam: shell, editor/ui, slash-items, notion/ImportWizard, guide (Rehber içeriği, tur, ipuçları, kısayollar), print, store toast'ları.
- Modify: `src/shared/i18n/{tr,en,de}.ts`
- Test: `test/unit/scripts/check-i18n.test.ts`

**Interfaces:**
- Consumes: Task 2'deki `useT`, `tNow`, `MessageKey`.
- Produces: `findHardcoded(source: string): { line: number; text: string }[]`. Önce `//` ve `/* */` yorumlarını atar. Sonra Türkçe harf (`[çğıöşüÇĞİÖŞÜ]`) içeren string literal ve JSX metinlerini döndürür.
- Produces: `npm run check:i18n`. Taranan klasörler: `src/renderer`, `src/main`. Hariç: `src/shared/i18n`, `src/renderer/assets/emoji-tr.ts`. Allowlist girdisi `dosya:metin` biçimindedir. Bulgu varsa çıkış kodu 1.
- Anahtar adları nokta ile gruplanır: `sidebar.*`, `settings.*`, `editor.*`, `slash.*`, `notion.*`, `guide.*`, `tour.*`, `tips.*`, `toast.*`, `export.*`, `history.*`, `home.*`, `menu.*`.
- Testlerin seçtiği metinler (`getByRole('menuitem', { name: 'Sürüm geçmişi' })` gibi) Türkçe kalır. Testler varsayılan dil olarak Türkçe çalışır: yardımcı `language: 'tr'` yazar (Task 1'deki ayar nesnesine eklenir).

- [ ] **Step 1: Başarısız test yaz**

```ts
it('yorumları atlar, Türkçe metin içeren literal ve JSX metnini bulur', () => {
  const src = "// açıklama yorumu\nconst a = 'Kaydedildi'\nconst b = 'Sayfa kaydedilemedi'\nreturn <p>Değişiklikler kaydedildi</p>\n/* çok satırlı\n yorum */"
  expect(findHardcoded(src).map((f) => f.line)).toEqual([3, 4])
})
```

- [ ] **Step 2: Çalıştır** — `npx vitest run test/unit/scripts/check-i18n.test.ts` → FAIL
- [ ] **Step 3: `findHardcoded` ve betiği uygula**; `npm run check:i18n` çıktısındaki her bulguyu sözlüğe taşı (İngilizce ve Almanca çevirileriyle). Rehber içeriği (`GuidePage`, `tips.ts`, `shortcuts.ts`, `Tour.tsx`) dahil.
- [ ] **Step 4: Doğrula** — `npm run check:i18n` → "Temiz" ; `npm test && npm run typecheck && npm run test:e2e` → hepsi PASS (Türkçe arayüz aynı kalır)
- [ ] **Step 5: Commit** — `feat(i18n): move renderer strings to dictionaries, add check:i18n`

---

### Task 4: Ana süreç metinleri ve uygulama menüsü

**Files:**
- Modify: `src/main/**` (diyaloglar, toast'lar, Notion hata ve rapor metinleri, `templates.ts` (Ders notu şablonu ve `formatDateTr` → `formatLongDate`), `backup.ts`, `export.ts`, `window.ts` kapanış diyaloğu)
- Create: `src/main/menu.ts`
- Modify: `src/shared/i18n/{tr,en,de}.ts`
- Test: `test/unit/main/notion-importer.test.ts`, `test/unit/main/templates.test.ts` (dil parametreli beklentiler)

**Interfaces:**
- Consumes: `mainT`, `mainLang`, `formatLongDate`.
- Produces: `buildAppMenu(lang: Lang): Menu`. Menüler: Kernel (Hakkında, Ayarlar ⌘,, Gizle, Çık), Düzen (standart roller), Görünüm (Kenar çubuğu ⌘\\, İçindekiler ⇧⌘T, Yeniden yükle yalnızca geliştirmede), Pencere. Dil değişince menü yeniden kurulur (`settings.write` sonrası).
- Notion içe aktarıcı ve şablonlar, oluşturuldukları andaki dili kullanır: `NotionImporter` deps'e `lang: Lang` eklenir; `TemplateStore.create(..., lang)`.

- [ ] **Step 1: Başarısız testler**: Notion rapor sayfası `lang: 'en'` ile "## Summary" ve "- Pages: 5" içerir; kök klasör adı `Notion import (2026-11-04)`. Şablon `lang: 'de'` ile Almanca başlıklar içerir (Türkçe "Özet" geçmez).
- [ ] **Step 2: Çalıştır** — `npx vitest run test/unit/main/notion-importer.test.ts test/unit/main/templates.test.ts` → FAIL
- [ ] **Step 3: Uygula**; `npm run check:i18n` main tarafında da temiz.
- [ ] **Step 4: Doğrula** — `npm test && npm run check:i18n && npm run typecheck` → PASS
- [ ] **Step 5: Commit** — `feat(i18n): main process strings, localized app menu`

---

### Task 5: Dil seçimi arayüzü ve canlı geçiş

**Files:**
- Modify: `src/renderer/shell/SettingsDialog.tsx` (dil, not yazı tipi, açılış görünümü için segment kontrolleri; mockup "Ayarlar")
- Modify: `src/renderer/state/store.ts` (dil değişince yeniden render; `systemLocale`)
- Modify: `src/renderer/styles/app.css` (segment kontrolü, `text-overflow: ellipsis`)
- Test: `test/e2e/language.spec.ts`

**Interfaces:**
- Consumes: `Settings.language`, `useT`, `buildAppMenu`.
- Produces: data-testid `setting-language` (radiogroup; seçenekler `setting-language-tr|en|de`), `setting-font-sans|serif`, `setting-start-home|last`.

- [ ] **Step 1: Başarısız e2e**

```ts
test('dil yeniden başlatmadan değişir; Almanca etiketler taşmaz', async () => {
  const { app, win } = await launch()
  await win.getByRole('button', { name: 'Ayarlar' }).click()
  await win.getByTestId('setting-language-en').click()
  await expect(win.getByTestId('sidebar')).toContainText('Settings')
  await win.getByTestId('setting-language-de').click()
  await expect(win.getByTestId('sidebar')).toContainText('Einstellungen')
  const overflow = await win.evaluate(() => [...document.querySelectorAll('[data-testid="sidebar"] button, [data-testid="sidebar"] a, .settings-dialog label')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis').length)
  expect(overflow).toBe(0)
  await app.close()
})
```

- [ ] **Step 2: Çalıştır** — `npm run build && npx playwright test test/e2e/language.spec.ts` → FAIL
- [ ] **Step 3: Uygula**
- [ ] **Step 4: Doğrula** — aynı komut → PASS; ayrıca Almanca ayarlar ve kenar çubuğunun ekran görüntüsünü al ve gözle kontrol et.
- [ ] **Step 5: Commit** — `feat(settings): language switcher with live update`

---

### Task 6: Görsel token'lar: aurora, yazı alanı degradesi, saydam kenar çubuğu, yazı tipleri

**Files:**
- Modify: `src/renderer/styles/tokens.css`, `app.css`, `editor.css`, `glass.css`, `print.css`
- Modify: `test/pdf/baseline/*.png` (yeniden üret)
- Test: `test/unit/renderer/tokens-contrast.test.ts`, `test/e2e/visual.spec.ts`

**Interfaces:**
- Produces (CSS değişkenleri, açık ve koyu):
  - `--aurora`: 3 radyal degrade, spec §18.1 renk ve opaklıkları.
  - `--paper-top` / `--paper-bottom`: opak hex değerleri. Açık `#FFFFFF` → `#E5E9EE`, koyu `#14191F` → `#2A313A`.
  - `--paper-alpha: 0.95`.
  - `--side-top` / `--side-bottom`: yarı saydam kenar çubuğu.
  - `--font-display`: `-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif`.
  - `--font-rounded`: `ui-rounded, 'SF Pro Rounded', -apple-system, sans-serif`.
- `.page-surface` zemini: `linear-gradient(color-mix(in srgb, var(--paper-top) calc(var(--paper-alpha)*100%), transparent), color-mix(... var(--paper-bottom) ...))` ve `background-attachment: fixed`. Degrade pencere yüksekliğine sabitlenir.
- `.app` zemini: `var(--aurora), var(--bg)`. `@media (prefers-reduced-transparency: reduce)` altında aurora yok, kağıt `--paper-top`.
- Not metni varsayılanı: `--font-body: var(--font-ui)`, 16 px, satır yüksekliği 1.65. `[data-body-font="serif"]` New York'u kullanır. Başlıklar `--font-display`, 700, `letter-spacing: -0.02em`.
- `print.css`: aurora, degrade ve cam yok; beyaz zemin.

- [ ] **Step 1: Başarısız testler.** Kontrast testi `tokens.css` dosyasını okur, açık ve koyu bloklardan `--text`, `--text-2`, `--text-3` ile `--paper-top` / `--paper-bottom` değerlerini ayrıştırır ve her çift için kontrast ≥ 4.5 bekler. Görsel e2e testi:

```ts
test('uzun notta degrade pencereye sabit: kaydırınca metnin arkası koyulaşmaz', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Uzun.md'), Array.from({ length: 200 }, (_, i) => `Satır ${i} gezegen yörüngesi.`).join('\n\n'))
  const { app, win } = await launch(vault)
  await win.getByTestId('tree-row').filter({ hasText: 'Uzun' }).click()
  const bgAt = () => win.evaluate(() => getComputedStyle(document.querySelector('.page-surface')!).backgroundAttachment)
  expect(await bgAt()).toContain('fixed')
  await app.close()
})
```

- [ ] **Step 2: Çalıştır** — `npx vitest run test/unit/renderer/tokens-contrast.test.ts` ve `npm run build && npx playwright test test/e2e/visual.spec.ts` → FAIL
- [ ] **Step 3: Uygula.** Ardından PDF referanslarını yeniden üret (`test/pdf` testindeki güncelleme yolunu kullan). Yeni PNG'lere bakıp fontun SF Pro olduğunu ve düzenin kaymadığını gözle doğrula.
- [ ] **Step 4: Doğrula** — `npm test && npm run test:e2e` → PASS; açık ve koyu tema ekran görüntülerini mockup'la karşılaştır.
- [ ] **Step 5: Commit** — `feat(ui): paper gradient, aurora backdrop, translucent sidebar, SF Pro typography`

---

### Task 7: İkon seti

**Files:**
- Create: `src/renderer/assets/icons.tsx`
- Test: `test/unit/renderer/icons.test.tsx` (vitest + react-dom/server)

**Interfaces:**
- Produces: `type IconName = 'home' | 'plus' | 'doc' | 'template' | 'grid' | 'search' | 'settings' | 'help' | 'pin' | 'chevron-down' | 'chevron-right' | 'download' | 'image'`.
- Produces: `Icon({ name, size = 16, title }: { name: IconName; size?: number; title?: string }): JSX.Element`. 16×16 viewBox, 1.5 px çizgi, `currentColor`. `title` yoksa `aria-hidden="true"`, varsa `role="img"` ve `aria-label`. Çizimler mockup'taki SVG'lerden alınır.

- [ ] **Step 1: Başarısız test** — her `IconName` için `renderToStaticMarkup(<Icon name={n} />)` bir `<svg` ve `aria-hidden="true"` içerir; `title="Ana sayfa"` verilince `aria-label="Ana sayfa"`.
- [ ] **Step 2–4:** çalıştır (FAIL) → uygula → `npx vitest run test/unit/renderer/icons.test.tsx` PASS
- [ ] **Step 5: Commit** — `feat(ui): icon set`

---

### Task 8: Kenar çubuğu yeniden tasarımı ve "Yeni" menüsü

**Files:**
- Modify: `src/renderer/shell/Sidebar.tsx`, `src/renderer/shell/PageTree.tsx` (satır stili), `src/renderer/styles/app.css`
- Create: `src/renderer/shell/NewMenu.tsx`
- Delete: `src/renderer/shell/TemplateMenu.tsx` (işlevi `NewMenu`'ye taşınır)
- Modify: `test/e2e/*.spec.ts` içinde `notion-import` ve şablon menüsü kullanan testler
- Test: `test/e2e/sidebar.spec.ts`

**Interfaces:**
- Consumes: `Icon`, `useT`, `TemplateStore` IPC'si (mevcut `kernel.templates`), `useStore.openHome` (Task 12; bu task'ta "Ana sayfa" satırı `openHome` yoksa gizli değil, Task 12'ye kadar `openPage(null)` çağırır).
- Yerleşim, üstten alta (mockup "Kenar çubuğu"):
  1. Trafik ışıkları için sürükleme alanı.
  2. Logo ve "Kernel" (17 px, `--font-rounded`, 650).
  3. Arama.
  4. Bölünmüş "Yeni" düğmesi: sol parça boş sayfa oluşturur ve `data-testid="new-page"` testid'ini korur; sağdaki ok `data-testid="new-menu"` ile cam menüyü açar.
  5. "Ana sayfa" satırı (`data-testid="nav-home"`).
  6. "Sabitlenenler" (Task 9).
  7. "Sayfalar" (ağaç).
  8. Alt kısım: Rehber, Ayarlar.
- `NewMenu` öğeleri:
  - `new-blank`: Boş sayfa ⌘N
  - `new-lecture`: Ders notu
  - `new-from-template`: Şablondan…
  - `notion-import`: Notion'dan aktar. Testid aynı kalır; testler önce `new-menu`'yü açar.
- Menü klavyeyle kullanılır: ↑ ↓ Enter Esc. Odak menüden çıkınca kapanır.
- Satırlar: üzerine gelince `--hover` hap, seçili satır vurgu tonlu hap, uzun ad `text-overflow: ellipsis`.

- [ ] **Step 1: Başarısız e2e** — `new-menu` açılır, dört öğe görünür; `new-lecture` "Ders notu" şablonundan sayfa oluşturur (dosyada şablon başlıkları var); Esc kapatır; `new-page` doğrudan boş sayfa oluşturur.
- [ ] **Step 2: Çalıştır** — `npm run build && npx playwright test test/e2e/sidebar.spec.ts` → FAIL
- [ ] **Step 3: Uygula**; `notion-import`'u doğrudan tıklayan testlere `await win.getByTestId('new-menu').click()` ekle.
- [ ] **Step 4: Doğrula** — `npm run test:e2e` → PASS
- [ ] **Step 5: Commit** — `feat(ui): redesigned sidebar with split New menu`

---

### Task 9: Sabitlenen sayfalar

**Files:**
- Create: `src/main/pins.ts`
- Modify: `src/main/ipc-handlers.ts`, `src/shared/types.ts` (KernelApi `pins`), `src/shared/ipc.ts`, `src/preload/index.ts`
- Modify: `src/renderer/shell/Sidebar.tsx` (Sabitlenenler bölümü), `ContextMenu` çağrıları (`PageTree.tsx`), `PageHeader.tsx` (iğne düğmesi)
- Test: `test/unit/main/pins.test.ts`, `test/e2e/pins.spec.ts`

**Interfaces:**
- Produces: `class PinStore { constructor(root: string); list(): Promise<string[]>; set(ids: string[]): Promise<void> }`. Veri `.kernel/pins.json` içinde `{ "ids": [...] }`; yinelenenler atılır.
- Produces: `KernelApi.pins: { list(): Promise<string[]>; set(ids: string[]): Promise<void> }`. `list`, ağaçta olmayan kimlikleri döndürmez ve dosyadan da temizler.
- Bağlam menüsünde "Sabitle" / "Sabitlemeyi kaldır" (`menuitem` adları). Sayfa başlığında `data-testid="pin-toggle"`. Kenar çubuğundaki satırlar `data-testid="pin-row"`; sürükle-bırakla sıralanır.

- [ ] **Step 1: Başarısız testler.** Birim: `set(['a','b','a'])` sonrası `list()` → `['a','b']`. e2e:

```ts
test('sabitlenen sayfa kenar çubuğunda görünür; taşınınca kalır, çöpe atılınca düşer', async () => {
  // iki sayfa oluştur, "Mars"ı sağ tık → Sabitle; pin-row "Mars" içerir
  // Mars'ı diğer sayfanın altına sürükle → pin-row hâlâ "Mars"
  // Mars'ı çöpe at → pin-row sayısı 0, uygulama hatasız (konsolda error yok)
})
```

- [ ] **Step 2: Çalıştır** → FAIL
- [ ] **Step 3: Uygula**
- [ ] **Step 4: Doğrula** — `npx vitest run test/unit/main/pins.test.ts && npm run build && npx playwright test test/e2e/pins.spec.ts` → PASS
- [ ] **Step 5: Commit** — `feat: pinned pages`

---

### Task 10: Etkinlik kaydı

**Files:**
- Create: `src/main/activity.ts`
- Modify: `src/main/ipc-handlers.ts` (`pages.write` sonrası kayıt), `src/core/home.ts` (yalnızca `localDay`)
- Test: `test/unit/main/activity.test.ts`

**Interfaces:**
- Produces: `localDay(d: Date): string`. Yerel tarih, `YYYY-MM-DD` biçiminde. Konumu `src/core/home.ts`.
- Produces: `class ActivityStore { constructor(root: string, now: () => Date); record(pageId: string): Promise<void>; read(): Promise<Record<string, string[]>>; seedIfMissing(pages: PageSummary[]): Promise<void> }`.
  - Veri `.kernel/activity.json` içinde: gün → benzersiz sayfa kimlikleri.
  - `record` çağrısı 400 günden eski girdileri siler. Yazımlar sıraya alınır, eşzamanlı çağrılar veri kaybetmez.
  - `seedIfMissing` dosya yoksa her sayfanın `updated` gününe o sayfayı ekler.
- Consumes: `PageSummary` (Task 11'de tanımlanır; bu task'ta tipi `src/shared/types.ts`'e ekle).

- [ ] **Step 1: Başarısız testler**

```ts
it('yerel güne yazar (23:30 düzenlemesi o güne)', async () => {
  const s = new ActivityStore(root, () => new Date(2026, 10, 5, 23, 30))
  await s.record('a'); await s.record('a'); await s.record('b')
  expect(await s.read()).toEqual({ '2026-11-05': ['a', 'b'] })
})
it('400 günden eskiyi siler', async () => { /* 2025-09-01 girdisi + bugünkü kayıt → yalnızca bugünkü kalır */ })
it('eşzamanlı kayıtlar kaybolmaz', async () => { await Promise.all(['a','b','c','d'].map((id) => s.record(id))); expect((await s.read())['2026-11-05']).toHaveLength(4) })
it('dosya yoksa updated tarihlerinden doldurur, varsa dokunmaz', async () => { /* ... */ })
```

- [ ] **Step 2–4:** çalıştır (FAIL) → uygula → `npx vitest run test/unit/main/activity.test.ts` PASS
- [ ] **Step 5: Commit** — `feat: activity log for the home heatmap`

---

### Task 11: Ana sayfa verisi ve canlı yenileme olayı

**Files:**
- Modify: `src/main/vault/vault.ts` (`summaries()`; önbellek `Cached` alanlarına `title`, `cover`, `created`, `updated` eklenir)
- Modify: `src/core/home.ts` (`computeHome`)
- Modify: `src/main/ipc-handlers.ts`, `src/shared/types.ts`, `src/shared/ipc.ts`, `src/preload/index.ts`
- Test: `test/unit/core/home.test.ts`, `test/unit/main/vault/summaries.test.ts`

**Interfaces:**
- Produces (types):
  - `interface PageSummary { id: string; title: string; path: string; parentId: string | null; icon?: string; cover?: string; created?: string; updated?: string; childCount: number }`
  - `interface HomeItem { id: string; title: string; icon?: string; parentTitle?: string; at?: string }`
  - `interface HomeCourse { id: string; title: string; icon?: string; cover?: string; childCount: number; descendantCount: number; lastUpdated?: string }`
  - `interface HomeData { courses: HomeCourse[]; pins: HomeItem[]; recentEdited: HomeItem[]; recentAdded: HomeItem[]; activity: { day: string; count: number }[]; totalPages: number }`
- Produces: `Vault.summaries(): Promise<PageSummary[]>`.
- Produces: `computeHome(pages: PageSummary[], pins: string[], activity: Record<string, string[]>, today: string): HomeData`.
  - `courses`: üst seviye sayfalar, ağaç sırasıyla. `lastUpdated` alt sayfalar dahil en yeni tarih.
  - `recentEdited`: `updated`'e göre en yeni 8 sayfa. `recentAdded`: `created`'e göre en yeni 8.
  - `parentTitle`: en üst seviyedeki atanın (dersin) başlığı. Üst seviye sayfada yok.
  - `activity`: tam 84 gün, bugünle biten, en eskiden en yeniye.
  - `pins`: listedeki sırayla; bulunmayanlar atlanır.
- Produces: `KernelApi.home.data(): Promise<HomeData>`; `events.onHomeChanged(cb: () => void): () => void`.
  - Main, `home.changed` olayını şu durumlarda yayınlar: pages write/create/rename/move/trash, izleyici değişikliği, `pins.set`. Olaylar 500 ms içinde birleştirilir.

- [ ] **Step 1: Başarısız testler**

```ts
it('dersler, son düzenlenen/eklenenler, ata dersi ve 84 günlük etkinlik', () => {
  const pages: PageSummary[] = [
    { id: 'g', title: 'Gezegenler', path: 'Gezegenler.md', parentId: null, childCount: 2, updated: '2026-11-01T10:00:00Z', created: '2026-10-01T10:00:00Z' },
    { id: 'm', title: 'Mars', path: 'Gezegenler/Mars.md', parentId: 'g', childCount: 0, updated: '2026-11-05T09:00:00Z', created: '2026-11-04T09:00:00Z' },
    { id: 'v', title: 'Venüs', path: 'Gezegenler/Venüs.md', parentId: 'g', childCount: 0, updated: '2026-11-03T09:00:00Z', created: '2026-11-05T08:00:00Z' },
    { id: 's', title: 'Sıralama', path: 'Sıralama.md', parentId: null, childCount: 0 }
  ]
  const h = computeHome(pages, ['v', 'yok'], { '2026-11-05': ['m', 'v'], '2026-08-01': ['m'] }, '2026-11-05')
  expect(h.courses.map((c) => [c.id, c.descendantCount, c.lastUpdated])).toEqual([['g', 2, '2026-11-05T09:00:00Z'], ['s', 0, undefined]])
  expect(h.recentEdited.map((i) => i.id)).toEqual(['m', 'v', 'g'])
  expect(h.recentAdded[0]).toMatchObject({ id: 'v', parentTitle: 'Gezegenler' })
  expect(h.pins.map((p) => p.id)).toEqual(['v'])
  expect(h.activity).toHaveLength(84)
  expect(h.activity.at(-1)).toEqual({ day: '2026-11-05', count: 2 })
  expect(h.activity[0]!.day).toBe('2026-08-14')
})
```

Ayrıca: `summaries()` frontmatter'daki `cover`, `created` ve `updated` alanlarını döndürür; `childCount` doğru. Performans (spec: 500 sayfada 200 ms altı): geçici kasada 500 sayfa (50 ders × 9 alt sayfa) oluştur; ısınmış önbellekle `summaries()` + `computeHome(...)` toplamı 200 ms altında.

- [ ] **Step 2–4:** çalıştır (FAIL) → uygula → `npx vitest run test/unit/core/home.test.ts test/unit/main/vault/summaries.test.ts` PASS
- [ ] **Step 5: Commit** — `feat: home data and live change event`

---

### Task 12: Ana sayfa görünümü

**Files:**
- Create: `src/renderer/home/HomePage.tsx`, `src/renderer/home/ActivityHeatmap.tsx`, `src/renderer/home/CourseCard.tsx`, `src/renderer/styles/home.css`
- Modify: `src/renderer/state/store.ts` (`view: 'home' | 'page'`, `openHome()`; `openPage` görünümü 'page' yapar; `init` `startView`'a göre başlar), `src/renderer/App.tsx`, `src/renderer/main.tsx` (css)
- Test: `test/e2e/home.spec.ts`

**Interfaces:**
- Consumes: `kernel.home.data`, `events.onHomeChanged`, `formatLongDate`, `formatRelative`, `tn`, `Icon`, `localDay`.
- Bölüm sırası (spec §18.2, mockup "Ana sayfa"):
  1. Karşılama. Saat 5–12 "Günaydın", 12–18 "İyi günler", 18–22 "İyi akşamlar", 22–5 "İyi geceler".
  2. Hızlı başlat: arama (`home-search`, tıklayınca Cmd+K paleti), `home-new`, `home-lecture`.
  3. Isı haritası (`home-heatmap`; 84 hücre, `data-count`; `title` ipucunda "5 Kasım: 3 sayfa").
  4. Sabitlenenler (`home-pin`).
  5. Dersler (`home-course`). Kapak varsa `kernel-file://` küçük resmi, yoksa ikona göre degrade yer tutucu.
  6. Son düzenlenenler (`home-recent-edited`) ve son eklenenler (`home-recent-added`).
  7. Boş kasada `home-empty` (İlk notunu oluştur, Notion'dan aktar).
- Canlı yenileme: `onHomeChanged` gelince veri yeniden çekilir. Gece yarısı zamanlayıcısı karşılamayı ve haritayı yeniler.

- [ ] **Step 1: Başarısız e2e**

```ts
test('ana sayfa açılışta gelir, kayıtla canlı güncellenir', async () => {
  const vault = tmpVault()
  writeFileSync(join(vault, 'Gezegenler.md'), '---\nicon: "🪐"\n---\nGüneş sistemi.\n')
  const { app, win } = await launch(vault, {}, { home: true })
  await expect(win.getByTestId('home-course')).toHaveCount(1)
  await expect(win.getByTestId('home-heatmap').locator('[data-count]')).toHaveCount(84)
  await win.getByTestId('home-course').click()
  await win.getByTestId('editor').click(); await win.keyboard.type(' Mars.')
  await win.getByTestId('nav-home').click()
  await expect(win.getByTestId('home-recent-edited')).toContainText('Gezegenler')
  await expect(win.getByTestId('home-heatmap').locator('[data-count="1"]')).toHaveCount(1)
  // ana sayfa açıkken dışarıdan yeni dosya → yenilemeden görünür
  writeFileSync(join(vault, 'Sıralama.md'), 'Quicksort.\n')
  await expect(win.getByTestId('home-course')).toHaveCount(2, { timeout: 5000 })
  await app.close()
})
test('boş kasada boş durum', async () => { /* home-empty görünür */ })
```

- [ ] **Step 2: Çalıştır** — `npm run build && npx playwright test test/e2e/home.spec.ts` → FAIL
- [ ] **Step 3: Uygula**
- [ ] **Step 4: Doğrula** — aynı komut PASS; `npm run test:e2e` PASS; açık ve koyu temada ekran görüntüsünü mockup'la karşılaştır.
- [ ] **Step 5: Commit** — `feat: home page`

---

### Task 13: İkonlu sayfa linkleri ve sayfa satırları

**Files:**
- Modify: `src/renderer/editor/nodes/WikiLink.ts` (node view: ikon ve başlık)
- Create: `src/renderer/editor/page-row.ts` (ProseMirror eklentisi)
- Modify: `src/renderer/editor/extensions.ts`, `src/renderer/styles/blocks.css`
- Test: `test/e2e/wikilink.spec.ts` (genişlet)

**Interfaces:**
- Consumes: `resolveWikiTarget(tree, target)` (`src/core/wiki.ts`), `useStore.getState().tree`.
- Satır içi wiki link:
  - `span.wiki-link` içinde `span.wiki-icon` (hedef ikonu ya da `Icon name="doc"`) ve etiket.
  - Renk `var(--text)`, alt çizgi yok. Üzerine gelince `--hover` zemin ve ince alt çizgi.
  - Çözülmeyen link: `.wiki-link.missing`, `--text-3` renk, kesikli alt çizgi.
  - Ağaç değişince ikonlar güncellenir: node view `tree` aboneliğiyle yeniden çizer.
- `PageRow` eklentisi: tek içeriği bir `wikiLink` olan paragrafa `class="page-row"` dekorasyonu ekler. CSS: tam genişlik satır, 40 px yükseklik, ikon 18 px, üzerine gelince cam zemin ve sağda ok.
- Yalnızca görünüm değişir; Markdown çıktısı aynı kalır (mevcut round-trip testleri geçer).

- [ ] **Step 1: Başarısız e2e** — `Gezegenler.md` içeriği `[[Mars]]\n\nBakınız [[Mars]] ve [[Yok]].\n` ve `Gezegenler/Mars.md` (`icon: "🔴"`): ilk paragraf `.page-row`; satır içi link `.wiki-icon` "🔴" içerir; `[[Yok]]` `.missing`; ikinci paragraf `.page-row` değildir; dosya içeriği kayıttan sonra değişmez. Ayrıca yol ile çözülen `[[Gezegenler/Mars]]` aynı ikonu gösterir.
- [ ] **Step 2: Çalıştır** — `npm run build && npx playwright test test/e2e/wikilink.spec.ts` → FAIL
- [ ] **Step 3: Uygula**
- [ ] **Step 4: Doğrula** — aynı komut ve `npm test` PASS
- [ ] **Step 5: Commit** — `feat(editor): page links with icons and page rows`

---

### Task 14: Cam yüzeylerin tutarlılığı

**Files:**
- Modify: `src/renderer/styles/glass.css`, `blocks.css`, `app.css` (BubbleToolbar, ContextMenu, SlashMenu, SearchPalette, TableMenu, toast'lar)
- Test: `test/e2e/visual.spec.ts` (genişlet)

**Interfaces:**
- Produces: `.glass-pop` sınıfı. 14 px köşe, `--glass-*` token'ları, `lang-in` açılış animasyonu (0.14 s). `prefers-reduced-motion` altında animasyon yok. Bu sınıf 0.2.4'teki `.lang-picker` stilinden türetilir; `.lang-picker` da onu kullanır.

- [ ] **Step 1: Başarısız e2e** — `/` menüsü, sağ tık menüsü, biçim çubuğu ve dil seçici açıkken her birinin `border-radius` değeri `14px` ve `animation-name` değeri `lang-in`. `emulateMedia({ reducedMotion: 'reduce' })` altında `animation-name: none`.
- [ ] **Step 2–4:** çalıştır (FAIL) → uygula → `npm run build && npx playwright test test/e2e/visual.spec.ts` PASS
- [ ] **Step 5: Commit** — `feat(ui): consistent glass popovers`

---

### Task 15: Rehber güncellemesi

**Files:**
- Modify: `src/renderer/guide/GuidePage.tsx`, `tips.ts`, `shortcuts.ts`, `src/shared/i18n/{tr,en,de}.ts`
- Test: `test/e2e/guide.spec.ts` (genişlet)

**Interfaces:**
- Yeni bölümler: "Ana sayfa" (canlı mini örnek: 3 haftalık küçük ısı haritası), "Sabitleme", "Dil ve görünüm" (dil seçimi, not yazı tipi, açılış görünümü).
- Yeni ipucu: ilk sabitlemede "Sabitlenen sayfalar ana sayfada ve kenar çubuğunda görünür."
- Tüm metinler üç dilde.

- [ ] **Step 1: Başarısız e2e** — Rehber'de "Ana sayfa", "Sabitleme", "Dil ve görünüm" bölümleri; dil İngilizceyken "Home", "Pinning", "Language and appearance".
- [ ] **Step 2–4:** çalıştır (FAIL) → uygula → PASS
- [ ] **Step 5: Commit** — `docs(guide): home, pinning, language sections`

---

### Task 16: Sürüm, belgeler ve paket

**Files:**
- Modify: `package.json` (0.3.0), `CLAUDE.md` (Faz 3 notları: i18n yapısı, `check:i18n`, `pins.json`, `activity.json`, yardımcıdaki `home` seçeneği), `README.md` (Faz 3 özellikleri, üç dil)

- [ ] **Step 1: Tam doğrulama** — `npm run typecheck && npm test && npm run check:i18n && npm run check:private && npm run test:e2e` → hepsi PASS
- [ ] **Step 2: Paket** — `npm run dist` → `release/Kernel-0.3.0-arm64.dmg`
- [ ] **Step 3: Commit** — `chore: release v0.3.0`
- [ ] **Step 4:** Kurulum ve push için kullanıcı onayı iste (push yalnızca onayla).
