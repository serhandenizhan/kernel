# Kernel — Claude için proje rehberi

Kernel: lokal, açık kaynak, Markdown tabanlı macOS + Windows not uygulaması (Notion alternatifi). Electron + React + TipTap.

- Spec: `docs/superpowers/specs/2026-11-04-kernel-design.md`
- Faz 1 planı: `docs/superpowers/plans/2026-11-04-kernel-phase-1-core.md`
- Faz 4 planı: `docs/superpowers/plans/2026-11-05-kernel-phase-4-knowledge.md`

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
- CI: `.github/workflows/ci.yml` (macOS + Windows testleri), `release.yml` (`v*` etiketiyle dmg + exe yükler).

## Mimari
- `src/main` — Electron ana süreç (pencere, kasa, arama, PDF)
- `src/preload` — `window.kernel` köprüsü
- `src/renderer` — React arayüzü
- `src/core` — markdown ⇄ editör dönüşümü, akıllı yapıştırma
- `src/shared` — ortak tipler
