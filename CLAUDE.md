# Kernel — Claude için proje rehberi

Kernel: lokal, açık kaynak, Markdown tabanlı macOS + Windows not uygulaması (Notion alternatifi). Electron + React + TipTap.

- Spec: `docs/superpowers/specs/2026-11-04-kernel-design.md`
- Faz 1 planı: `docs/superpowers/plans/2026-11-04-kernel-phase-1-core.md`
- Faz 4 planı: `docs/superpowers/plans/2026-11-05-kernel-phase-4-knowledge.md`
- Faz 5 planı: `docs/superpowers/plans/2026-11-06-kernel-phase-5-charts.md`

## KESİN KURAL: Kullanıcı notları asla repoya girmez
- Kasa varsayılan olarak `~/Documents/Kernel` (repo dışında). Testler yalnızca `os.tmpdir()` altında geçici kasa kullanır (`KERNEL_VAULT` env).
- `test/fixtures/private/` gitignore'lu (kullanıcının gerçek örnekleri).
- Her commit öncesi `npm run check:private` (repo ↔ test/fixtures/private örtüşme taraması) temiz olmalı ve `git status` ile not / görsel sızıntısı kontrol edilmeli. Test verileri her zaman sıfırdan yazılır; kullanıcının notlarından satır kopyalanmaz. Notion token asla dosyaya yazılmaz.
- Push yalnızca kullanıcı onayıyla.

## Komutlar
- `npm run dev` — geliştirme
- `npm test` — birim testleri (Vitest, `test/unit`)
- `npm run test:e2e` — build + Playwright Electron testleri (`test/e2e`)
- `npm run typecheck` — TS 7 (baseUrl yok; paths `./` ile başlar)
- `npm run check:i18n` — arayüzde sözlük dışı (sabit yazılmış) metin taraması; izin listesi `scripts/i18n-allow.txt`
- `npm run dist` — `.app` / `.dmg` (electron-builder, arm64)
- `npm run dist:win` — Windows NSIS kurulumu (`release/Kernel-Setup-<sürüm>.exe`, Mac'te de derlenir)

## Kurallar
- Kod ve tanımlayıcılar İngilizce, **yorumlar Türkçe**, arayüz metinleri Türkçe.
- Güvenlik: contextIsolation, sandbox açık, nodeIntegration kapalı; arayüz diske yalnızca `window.kernel` ile erişir. Preload CJS (`out/preload/index.cjs`).
- `src/core/` saf modüllerdir (Electron/DOM bağımlılığı yok) ve Node'da test edilir.
- TDD: önce başarısız test, sonra kod.

## Notlar (Faz 1 sonrası)
- Tüm npm paketleri devDependencies'tedir: electron-vite main/preload'u bundle'lar, `.app` içinde node_modules yoktur.
- e2e yardımcısı (`test/e2e/helpers/app.ts`) geçici kasa + geçici userData kullanır; turu/ipuçlarını varsayılan kapatır (`{ onboarding: true }` ile açılır).
- Yapıştırma testleri sentetik ClipboardEvent kullanır (sistem panosuna dokunulmaz).
- PDF: `#/print` görünümü + `printToPDF` (`src/main/pdf.ts`); testlerde `KERNEL_TEST_PDF_DIR`. Referans PNG'ler `test/pdf/baseline/`.

## Notlar (Faz 2)
- Notion: `src/core/notion` (saf dönüştürücü), `src/main/notion/{client,importer,service,fixture-client}.ts`. Testler `KERNEL_TEST_NOTION_FIXTURES` ile sentetik veri kullanır; gerçek Notion çıktısı asla test verisi yapılmaz.
- Token: `src/main/secrets.ts` yalnızca bellekte tutar (safeStorage/Keychain yok; macOS parola penceresi açılmasın). Chromium `use-mock-keychain` ile başlar; `test/unit/main/no-keychain.test.ts` bunu korur.
- Geçmiş `.kernel/history/`, yedek durumu `.kernel/backup.json`, şablonlar `.kernel/templates/`, yarım aktarım `.kernel/notion-import.json`.
- Test ortam değişkenleri: `KERNEL_TEST_HISTORY_INTERVAL_MS`, `KERNEL_TEST_BACKUP_DIR`, `KERNEL_TEST_PDF_DIR` (PDF/HTML/zip).

## Notlar (Faz 3)
- Diller: `src/shared/i18n/messages/*.ts` her anahtar `[Türkçe, English, Deutsch]` üçlüsü; `tr/en/de.ts` bunlardan türetilir. Renderer `useT()` / `tNow()`, main `mainT()`. Yeni arayüz metni her zaman sözlüğe eklenir; `{x}` çeviri yer tutucusu, `{{x}}` şablon değişkenidir.
- Ana sayfa: `computeHome` (`src/core/home.ts`, saf) + `Vault.summaries()`; `home.changed` olayı 500 ms içinde birleştirilir. Veri: `.kernel/pins.json`, `.kernel/activity.json` (yerel gün → sayfa kimlikleri, 400 gün).
- Ayar şeması 2: `language`, `startView`; eski ayarlar bir kerelik SF Pro'ya göçer. Ayar yazımları sıraya alınır.
- e2e yardımcısı ayarlara `language: 'tr'` ve `startView: 'last'` yazar; ana sayfa testleri `launch(vault, {}, { home: true })`.
- Görünüm token'ları `src/renderer/styles/tokens.css` (`--paper-top/bottom`, `--aurora`, `--side-*`); kontrast testi `test/unit/renderer/tokens-contrast.test.ts`.

## Notlar (Faz 4)
- Bilgi ağı: `src/core/links.ts` (link / etiket çıkarımı, `renameLinks`), `src/core/wiki.ts` (`filterPages`, `linkTargetFor`), `src/core/graph.ts`, `src/core/cards.ts`. Ana süreçte `LinkIndex` (`src/main/links.ts`) geri bağlantı, graf, etiket ve kartları besler; yeniden adlandırma / taşımada `rewriteLinksAfterRelocate` kasadaki linkleri günceller. Olay `links.changed` 500 ms içinde birleştirilir.
- Flashcard: `SrsStore` (`src/main/srs.ts`, `ts-fsrs`) → `.kernel/srs.json`; bozuk dosya `srs.json.corrupt-<zaman>` olarak yedeklenir; yetim kart verisi 30 gün tutulur. Sınav modu vadeleri değiştirmez.
- Sekmeler renderer `localStorage`'ında (userData, kasa başına) tutulur. Bölünmüş ekranın ikinci editörü `activeEditor`'a dokunmaz; kaydı `extraFlushes` / `flushAll` ile yazılır. Aynı sayfa iki bölmede açılmaz.
- Cmd+W menüde `close-tab` komutudur (pencere: Cmd+Shift+W).

## Notlar (güncelleme + Windows)
- Güncelleme: `src/core/update.ts` (saf: `compareVersions`, `parseRelease`, `shouldOffer`; yalnızca `RELEASES_PREFIX` adresleri), `src/main/updates.ts` (GitHub `releases/latest`; `KERNEL_TEST` varken ağa çıkmaz, `KERNEL_TEST_UPDATE_FEED` sahte yanıt dosyası). Arayüz `UpdatePrompt.tsx`; ayar `updates: { check, skipped }`. Otomatik kurulum yok (imzasız uygulama), İndir tarayıcıda dosyayı açar.
- Windows: `window-options.ts` (Mac dışı normal çerçeve + opak zemin), `menu-template.ts` (Mac'e özgü roller yalnızca darwin'de, `Cmd` → `Ctrl`), `sanitizeTitle(title, platform)` Windows yasak karakter / ayrılmış adlar. Renderer `lib/platform.ts`: `isMac`, `modKey(e)`, `keys('⌘K')`; `useT`/`tNow` metinlerdeki ⌘ simgelerini Windows'ta `Ctrl+` yapar. e2e kısayolları `ControlOrMeta+`.
- Yapıştırma: web HTML'inde başlık/liste/tablo/kalın/link varsa HTML kullanılır (`STRUCTURED`); HTML metnindeki ham LaTeX `rewriteRawMath` ile korunur.
- Ad çakışması: yeniden adlandırma/taşıma bir başlığı belirsiz yaparsa, başka sayfayı gösteren `[[Ad]]` linkleri `[[Yol/Ad|Ad]]` olarak sabitlenir (`rewriteLinksAfterRelocate`).
- CI: `.github/workflows/ci.yml` (macOS + Windows testleri), `release.yml` (`v*` etiketiyle dmg + exe yükler).

## Notlar (Faz 5)
- Grafikler: ```` ```chart ```` kod bloğunda JSON (`src/core/charts/spec.ts`: `parseChart` / `normalizeChart` / `serializeChart` / `defaultChart`; 10 tür). Çizim saf `src/core/charts/render.ts` → SVG metni; tema renkleri CSS sınıflarından (`kc-*`, `blocks.css`). Arayüz `src/renderer/editor/ui/ChartBlock.tsx` (`CodeBlockView` `chart` dilinde çağırır); düzenleme kod bloğunun metnini değiştirir (⌘Z çalışır). "/" grafik öğeleri `slash-items.ts` (`chartFocus` paneli açık getirir). Bozuk JSON kod olarak kalır + `chart-invalid` uyarısı.
- İçindekiler şeridi: `TocPanel` 2+ başlıkta sağ kenarda çizgiler (`toc-rail`), Cmd+Shift+T sabit paneli.
- Yapıştırma: kod bloğuna çitli metin → `unfence`; HTML'deki SVG'ler `extractSvgs` (`src/core/smart-paste/svg.ts`, temizlenir) → `attachments/*.svg`.

## Notlar (uygulama içi güncelleme, kartlar, yazı tipi)
- Güncelleme: `parseRelease` `install` alanı (macOS `Kernel-<v>-arm64-mac.zip`, Windows exe). `src/main/update-install.ts` indirir → macOS'ta zip açılır, Info.plist kimliği + sürümü denetlenir, `macSwapScript` uygulama kapanınca paketi değiştirip açar; Windows'ta exe `/S --updated --force-run`. Kurulacak dosya yalnızca ana sürecin son denetiminden gelir. Testler: `KERNEL_TEST_UPDATE_ASSET` (yerel dosya), `KERNEL_TEST_UPDATE_DRYRUN` (plan dosyası; hiçbir şey çalışmaz).
- Sürüm notları: `docs/release-notes/<etiket>.md` (`<!-- tr -->`/`<!-- en -->`/`<!-- de -->` bölümleri) release iş akışında not olur; `src/core/release-notes.ts` arayüz dilini seçer, GitHub otomatik notunun teknik satırlarını atar.
- Kartlar: `CardHighlight` (`::` satırı `card-line`/`card-q`/`card-sep`/`card-a`; katlanır kartın DOM'una `data-card` süslemeyle verilir — düğüm görünümü özel özellikleri yazmıyor; boş cevapta `card-empty` ipucu).
- Testler arka planda: `KERNEL_TEST` varken ana pencere görünmez açılır (opaklık 0, tıklamaları geçirir, `showInactive` — çizilir ki End/Home gibi tuşlar CI'da da çalışsın), Dock simgesi gizlenir (`isHeadlessTest`, `src/main/window-options.ts`); odak çalınmaz. Hata ayıklarken `KERNEL_TEST_SHOW=1 npx playwright test ...`; README ekran görüntüleri (`KERNEL_SCREENSHOTS=1`) pencereyi görünür açar.
- Yazı tipi paketleri (`bodyFont`): `plex` (varsayılan; Fraunces başlık/h1/h2, IBM Plex Sans gövde, IBM Plex Mono kod), `bricolage` (Bricolage Grotesque başlık, Figtree gövde, DM Mono kod + küçük etiketler), `editorial` (Instrument Serif + Inter + JetBrains Mono), `space` (Space Grotesk + Inter + Space Mono), `book` (Literata + Fira Code), `rounded` (Nunito + JetBrains Mono), `sans`, `serif`. Seçici önizlemeli kartlar: `src/renderer/lib/font-packs.ts` + `FontPackPicker`. Token'lar `--font-heading`, `--font-subheading`, `--font-label`, `--heading-weight` (`tokens.css`); dosyalar `@fontsource*` paketleriyle uygulamaya gömülü; ayar şeması 3.
- Ayarlar → Güncellemeler → "Şimdi denetle" (`updates.checkNow`; açılış ayarı ve atlanan sürüm yok sayılır, ağ hatası "güncel" sayılmaz). Güncelleme penceresinin teklifi store'da (`updateOffer`).
- Tablo: köşedeki ⋯ düğmesi + hücrede sağ tık menüsü (`TableMenu.tsx`, `ContextMenu`). Kod blokları `--code-border` kenarlığıyla açık temada da seçilir.

## Mimari
- `src/main` — Electron ana süreç (pencere, kasa, arama, PDF)
- `src/preload` — `window.kernel` köprüsü
- `src/renderer` — React arayüzü
- `src/core` — markdown ⇄ editör dönüşümü, akıllı yapıştırma
- `src/shared` — ortak tipler
