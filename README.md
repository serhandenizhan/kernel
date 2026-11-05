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

## Özellikler (Faz 2)

- **Notion'dan aktarım:** Sihirbazla bağlan, sayfaları seç; ikon, kapak, görsel, formül, toggle, callout, tablo, alt sayfa ve sayfa bağlantıları (`[[wiki link]]`) gelir. Dosyalar anında indirilir, aktarım yarıda kalırsa kaldığı yerden sürer, sonunda doğrulama raporu oluşur. Token yalnızca macOS Anahtar Zinciri'nde şifreli tutulur.
- **Sürüm geçmişi:** En fazla 5 dakikada bir sürüm; farkları gör, tek tıkla geri dön.
- **Otomatik yedek:** Kasanın günlük zip yedeği seçtiğin klasöre (son 14 yedek).
- **Şablonlar:** "Ders notu" gibi şablonlardan sayfa; kendi şablonunu kaydet.
- **Mermaid diyagramları** ve **gömülü PDF görüntüleyici**.
- **Dışa aktarma:** PDF'e ek olarak Markdown (zip) ve tek dosyalık HTML.

### Notion'dan geçiş

1. Kernel'de kenar çubuğunda **Yeni ▾ → Notion'dan aktar**.
2. [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New integration** (Internal) → token'ı kopyala.
3. Notion'da aktaracağın her ana sayfada **••• → Connections → Kernel**.
4. Token'ı sihirbaza yapıştır, sayfaları seç, **Aktar**. Sonuç "Notion içe aktarım (tarih)" sayfasının altına gelir; mevcut notlarının üzerine hiçbir şey yazılmaz.

## Özellikler (Faz 3)

- **Yeni görünüm:** Yazı alanında yumuşak degrade (açıkta beyazdan griye, koyuda siyahtan griye), hareketsiz "aurora" zemin, saydam kenar çubuğu, SF Pro yazı tipleri ve tutarlı ikon seti. "Saydamlığı azalt" ve "Hareketi azalt" ayarlarına uyar.
- **Ana sayfa:** Haftalık etkinlik haritası (son 12 hafta), sabitlenenler, ders kartları, son düzenlenen ve eklenen notlar. Kaydettikçe kendiliğinden güncellenir.
- **Sabitleme:** Sağ tık → Sabitle ya da sayfa başlığındaki iğne.
- **Sayfa linkleri** hedef sayfanın ikonuyla görünür; tek başına duran link (Notion alt sayfa listeleri) sayfa satırı olur.
- **Diller:** Türkçe, English, Deutsch (Ayarlar → Dil; yeniden başlatma gerekmez, notlar çevrilmez).

Faz 4 (`[[` seçici, geri bağlantılar, graf, etiketler, sekmeler, flashcard'lar…) için: [`docs/superpowers/specs/2026-11-04-kernel-design.md`](docs/superpowers/specs/2026-11-04-kernel-design.md).

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
