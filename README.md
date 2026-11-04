# Kernel

**Lokal, açık kaynak, Markdown tabanlı macOS not uygulaması.** Ders notları için yapıldı: yapay zekâ araçlarından yapıştırılan formülleri ve kodu kendiliğinden düzeltir, sayfaları kaymasız PDF'e çevirir. Notların her zaman senin bilgisayarında, düz `.md` dosyaları olarak durur.

> *English:* Kernel is a local-first, open-source Markdown notes app for macOS (Electron + React + TipTap). It fixes math and code when you paste from NotebookLM/ChatGPT/Claude, exports pixel-faithful PDFs, and keeps every note as a plain Markdown file in a folder you own.

## Özellikler (Faz 1)

- **Akıllı yapıştırma:** NotebookLM'in çift kaçışlı `\\( \\)` / `\\[ \\]` formülleri, `$…$`, `$$…$$`, `\begin{align}` ve ayraçsız LaTeX satırları formüle dönüşür. Kodun dili otomatik tespit edilir. Hemen ardından ⌘Z ham metne döner, ⌘⇧V ham yapıştırır.
- **Blok editör:** başlıklar (1–6), listeler, yapılacaklar, toggle, callout, alıntı, tablo, görsel, kod (renklendirmeli), blok ve satır içi formül, `/` menüsü, biçim araç çubuğu, sürükle-bırak.
- **Sayfa ikonu ve kapak görseli**, alt sayfalar, sayfa ağacında sürükle-bırak.
- **⌘K tam metin arama** (Türkçe karakter duyarsız), içindekiler paneli, açık/koyu tema.
- **PDF export:** vektörel metin ve formüller, tam çözünürlüklü görseller, akıllı sayfa kırılımı, içindekiler (outline), sayfa numarası, alt sayfaları tek PDF'te birleştirme.
- **Tanıtım turu ve Kernel Rehberi (⌘/)**, kısayol tablosu.

Faz 2 (Notion aktarımı, sürüm geçmişi, yedekleme, şablonlar…) ve Faz 3 (`[[linkler]]`, graf, sekmeler, flashcard'lar…) için: [`docs/superpowers/specs/2026-11-04-kernel-design.md`](docs/superpowers/specs/2026-11-04-kernel-design.md).

## Kurulum

Gereksinimler: macOS (Apple Silicon), Node.js 22+.

```bash
git clone <repo-adresi> kernel
cd kernel
npm install
npm run dist
```

Çıktı: `release/mac-arm64/Kernel.app` ve `release/Kernel-<sürüm>-arm64.dmg`. `Kernel.app`'i Uygulamalar klasörüne sürükle. Uygulama Apple tarafından imzalanmadığı için ilk açılışta **sağ tık → Aç** demen gerekir.

## Notların nerede?

İlk açılışta bir **kasa** klasörü seçersin (önerilen: `~/Documents/Kernel`). Her sayfa bir `.md` dosyasıdır; alt sayfalar aynı adlı klasörde durur, görseller `attachments/` içindedir. İkon, kapak gibi bilgiler dosyanın başındaki küçük YAML bölümündedir. Notlarını VS Code, Obsidian ya da herhangi bir editörde açabilir, iCloud veya Git ile yedekleyebilirsin.

Kernel'in kendi ayarları kasadaki gizli `.kernel/` klasöründedir. Uzak sunucuya hiçbir veri gönderilmez.

## Geliştirme

```bash
npm run dev         # geliştirme modu
npm test            # birim testleri (Vitest)
npm run test:e2e    # uçtan uca testler (Playwright + Electron)
npx playwright test test/pdf   # PDF görsel regresyon testleri
npm run typecheck
```

Testler yalnızca geçici klasörler kullanır; gerçek kasana ve panona dokunmaz.

## Lisans

MIT
