<p align="center">
  <img src="build/icon.svg" width="128" height="128" alt="Kernel logosu">
</p>

<h1 align="center">Kernel</h1>

<p align="center">
  Notların senin bilgisayarında kalır. Lokal, açık kaynak, Markdown tabanlı not uygulaması — macOS ve Windows.<br>
  <em>Your notes stay on your computer. A local, open-source, Markdown-based note app for macOS and Windows.</em>
</p>

<p align="center">
  <a href="https://github.com/serhandenizhan/kernel/releases/latest"><img src="https://img.shields.io/github/v/release/serhandenizhan/kernel?label=%C4%B0ndir%20%C2%B7%20Download&style=for-the-badge&color=0e7c6b" alt="İndir / Download"></a>
</p>

<p align="center">
  <a href="#türkçe">Türkçe</a> · <a href="#english">English</a>
</p>

<p align="center">
  <img src="docs/screenshots/home-dark-tr.png" width="49%" alt="Kernel ana sayfa (koyu tema, Türkçe)">
  <img src="docs/screenshots/home-light-en.png" width="49%" alt="Kernel home (light theme, English)">
</p>

---

## Türkçe

Kernel, ders notları ve kişisel bilgi için yapılmış, macOS ve Windows'ta çalışan bir not uygulaması. Her sayfa diskte düz bir `.md` dosyasıdır: hesap yok, bulut yok, abonelik yok. Notlarını istediğin editörde açabilir, iCloud ya da Git ile yedekleyebilirsin.

### Öne çıkanlar

- **Rahat yazma** — `/` blok menüsü, başlıklar, listeler, callout'lar, toggle'lar, tablolar, kod blokları ve Mermaid diyagramları.
- **Formüller** — `$…$` ve `$$…$$` ile LaTeX; akıllı yapıştırma, ChatGPT ya da web sayfalarından kopyalanan formülleri, kodu ve biçimi (başlık, liste, tablo, link) korur.
- **Bilgi ağı** — `[[` ile sayfalar arası link, her sayfanın altında geri bağlantılar, `#etiket`ler ve tüm notların grafı. Bir sayfanın adını değiştirince linkler kendiliğinden güncellenir.
- **Flashcard'lar** — bir satıra `Soru :: Cevap` yaz; Kernel kartları FSRS ile aralıklı tekrar takvimine koyar. Sınav modu ve ana sayfada "Bugünün tekrarı".
- **Ana sayfa** — dersler kartlar halinde, son notlar, sabitlenenler ve etkinlik haritası.
- **Sekmeler ve bölünmüş ekran**, komut paleti (⌘P), arama (⌘K), odak modu (⌘⇧F).
- **Notion'dan geçiş** — sayfaların, alt sayfaların ve görsellerin Markdown'a aktarılır.
- **Dışa aktarma** — PDF, Markdown ve HTML; gömülü PDF'ler.
- **Güvence** — otomatik kayıt, sürüm geçmişi, otomatik yedek.
- **Türkçe, İngilizce ve Almanca** arayüz; açık ve koyu tema.
- **Güncelleme bildirimi** — yeni sürüm çıkınca açılışta sorar.

<p align="center">
  <img src="docs/screenshots/editor.png" width="49%" alt="Editör">
  <img src="docs/screenshots/graph.png" width="49%" alt="Graf görünümü">
</p>

### Kurulum

[Son sürüm](https://github.com/serhandenizhan/kernel/releases/latest) sayfasından indir:

- **macOS** — `.dmg` dosyasını aç, `Kernel.app`'i Uygulamalar klasörüne sürükle. Uygulama Apple tarafından imzalanmadığı için ilk açılışta **sağ tık → Aç** demen gerekir. (Apple Silicon Mac gerekir.)
- **Windows** — `Kernel-Setup-<sürüm>.exe` dosyasını çalıştır. Uygulama imzasız olduğu için SmartScreen uyarısında **Ek bilgi → Yine de çalıştır** de. (Windows 10/11, 64 bit.)

**Kaynaktan derle** (Node.js 22+):

```bash
git clone https://github.com/serhandenizhan/kernel.git
cd kernel
npm install
npm run dist
```

Çıktı: `release/mac-arm64/Kernel.app` ve `release/Kernel-<sürüm>-arm64.dmg`. Windows kurulumu için `npm run dist:win` (`release/Kernel-Setup-<sürüm>.exe`).

### Notların nerede?

İlk açılışta bir **kasa** klasörü seçersin (önerilen: `~/Documents/Kernel`). Her sayfa bir `.md` dosyasıdır; alt sayfalar aynı adlı klasörde, görseller `attachments/` içindedir. Kernel'in ayarları kasadaki gizli `.kernel/` klasöründedir. Notların hiçbir uzak sunucuya gönderilmez. Kernel açılışta yalnızca GitHub'daki son sürüm numarasını okur ve yeni sürüm varsa indirmek isteyip istemediğini sorar; bunu Ayarlar'dan kapatabilirsin.

---

## English

Kernel is a note app for macOS and Windows, built for lecture notes and personal knowledge. Every page is a plain `.md` file on your disk: no account, no cloud, no subscription. Open your notes in any editor and back them up with iCloud or Git.

### Highlights

- **Comfortable writing** — `/` block menu, headings, lists, callouts, toggles, tables, code blocks and Mermaid diagrams.
- **Math** — LaTeX with `$…$` and `$$…$$`; smart paste keeps formulas, code and formatting (headings, lists, tables, links) copied from ChatGPT or web pages.
- **Knowledge graph** — link pages with `[[`, see backlinks under every page, use `#tags`, and explore a graph of all your notes. Renaming a page updates its links everywhere.
- **Flashcards** — write `Question :: Answer` on a line; Kernel schedules cards with FSRS spaced repetition. Exam mode and "Today's review" on the home page.
- **Home page** — courses as cards, recent notes, pinned pages and an activity map.
- **Tabs and split view**, command palette (⌘P), search (⌘K), focus mode (⌘⇧F).
- **Move from Notion** — pages, subpages and images are imported as Markdown.
- **Export** — PDF, Markdown and HTML; embedded PDFs.
- **Peace of mind** — autosave, version history, automatic backups.
- **Turkish, English and German** interface; light and dark themes.
- **Update notice** — asks on launch when a new version is out.

### Install

Download from the [latest release](https://github.com/serhandenizhan/kernel/releases/latest):

- **macOS** — open the `.dmg` and drag `Kernel.app` into Applications. The app is not signed by Apple, so the first time you open it, **right-click → Open**. (Requires an Apple Silicon Mac.)
- **Windows** — run `Kernel-Setup-<version>.exe`. The app is unsigned, so in the SmartScreen warning choose **More info → Run anyway**. (Windows 10/11, 64-bit.)

**Build from source** (Node.js 22+): see the commands above; use `npm run dist:win` for the Windows installer.

### Where are my notes?

On first launch you pick a **vault** folder (suggested: `~/Documents/Kernel`). Each page is a `.md` file; subpages live in a folder with the same name, images in `attachments/`. Kernel's own settings are in the hidden `.kernel/` folder. Your notes are never sent to a remote server. On launch Kernel only reads the latest version number on GitHub and asks whether you want to download a new version; you can turn this off in Settings.

---

## Geliştirme · Development

```bash
npm run dev         # geliştirme modu · dev mode
npm test            # birim testleri · unit tests (Vitest)
npm run test:e2e    # uçtan uca testler · end-to-end tests (Playwright + Electron)
npm run typecheck
```

Testler yalnızca geçici klasörler kullanır. · Tests only use temporary folders.

## Lisans · License

MIT
