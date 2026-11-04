# Kernel — Claude için proje rehberi

Kernel: lokal, açık kaynak, Markdown tabanlı macOS not uygulaması (Notion alternatifi). Electron + React + TipTap.

- Spec: `docs/superpowers/specs/2026-11-04-kernel-design.md`
- Faz 1 planı: `docs/superpowers/plans/2026-11-04-kernel-phase-1-core.md`

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
- `npm run dist` — `.app` / `.dmg` (electron-builder, arm64)

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
- Token: `src/main/secrets.ts` (safeStorage). `KERNEL_TEST` altında Keychain yerine test deposu.
- Geçmiş `.kernel/history/`, yedek durumu `.kernel/backup.json`, şablonlar `.kernel/templates/`, yarım aktarım `.kernel/notion-import.json`.
- Test ortam değişkenleri: `KERNEL_TEST_HISTORY_INTERVAL_MS`, `KERNEL_TEST_BACKUP_DIR`, `KERNEL_TEST_PDF_DIR` (PDF/HTML/zip).

## Mimari
- `src/main` — Electron ana süreç (pencere, kasa, arama, PDF)
- `src/preload` — `window.kernel` köprüsü
- `src/renderer` — React arayüzü
- `src/core` — markdown ⇄ editör dönüşümü, akıllı yapıştırma
- `src/shared` — ortak tipler
