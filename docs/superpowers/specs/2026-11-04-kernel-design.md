# Kernel — Tasarım Dokümanı (Spec)

- **Tarih:** 2026-11-04
- **Durum:** Kullanıcı incelemesinde
- **Kapsam:** Tüm uygulama (3 faz)

---

## 1. Amaç ve bağlam

Kernel, Notion'ın yerine geçecek, **tamamen lokal çalışan, ücretsiz ve açık kaynak** bir macOS not uygulamasıdır. Birincil kullanım: **ders notları** — sayfa / alt sayfa hiyerarşisinde, blok tabanlı bir editörle yazılan, çoğu NotebookLM gibi yapay zekâ araçlarından yapıştırılan, formül ve kod ağırlıklı içerik.

### Başarı ölçütleri

1. NotebookLM (ve ChatGPT, Claude, Gemini) çıktısı yapıştırıldığında formüller ve kod blokları **elle düzeltme gerektirmeden** doğru bloklara dönüşür.
2. Herhangi bir sayfa, ekrandakiyle aynı görünümde, kaymasız ve görselleri net bir PDF olarak dışa aktarılır.
3. Notion'daki mevcut ~50 sayfa (ikon, kapak, görsel, formül, alt sayfa hiyerarşisi dahil) eksiksiz aktarılır; kayıp varsa raporlanır.
4. Uygulama Dock / Uygulamalar klasöründen çift tıklayarak açılır.
5. Notlar her zaman kullanıcının kendi diskinde, başka araçlarla da açılabilen düz Markdown dosyalarıdır.

### Kesin kısıtlar

- **Kullanıcının notları asla GitHub'a gitmez.** Kasa varsayılan olarak repo dışında (`~/Documents/Kernel`) durur; `.gitignore` ek güvence sağlar; her commit/push öncesi `git status` kontrol edilir. Notion API token'ı da asla repoya ya da kasaya yazılmaz.
- Uygulamanın **kaynak kodu açık kaynaktır** (GitHub, herkese açık repo, MIT lisansı).
- Tek kullanıcı, tek makine. Bulut senkronizasyonu yok (kullanıcı isterse kasa klasörünü iCloud/Git ile kendisi senkronlar).
- Platform: **macOS** (Apple Silicon öncelikli). Diğer platformlarda çalışması hedef değil, ama bilerek engellenmez.
- Tasarım Notion'a benzememeli; macOS / iOS doğasına uygun olmalı.

---

## 2. Teknoloji seçimi

| Katman | Seçim | Gerekçe |
|---|---|---|
| Masaüstü kabuğu | **Electron** | PDF export için Chromium baskı motoru (vektörel, kaymasız); olgun ekosistem; macOS vibrancy desteği |
| Arayüz | **React + TypeScript + Vite** (electron-vite) | Yaygın, tip güvenli, hızlı geliştirme |
| Editör | **TipTap (ProseMirror)** | Blok editör için en olgun altyapı; özel node ve yapıştırma kuralları için tam kontrol |
| Formül | **KaTeX** | Hızlı, baskıda net, LaTeX doğrulaması |
| Kod renklendirme | **Shiki** (render) + **highlight.js** (dil tespiti) | Shiki VS Code kalitesinde renklendirir; highlight.js'in `highlightAuto` fonksiyonu dil tahmini yapar |
| Markdown | **unified / remark** (+ remark-gfm, remark-math, remark-frontmatter) | Markdown ⇄ editör dönüşümü için standart araç zinciri |
| Durum yönetimi | **Zustand** | Basit, az kod |
| Arama | **MiniSearch** | Bellek içi tam metin arama, Türkçe karakter normalizasyonu |
| Dosya izleme | **chokidar** | Kasadaki dış değişiklikleri algılama |
| Paketleme | **electron-builder** | `.app` / `.dmg` üretimi |
| Test | **Vitest** (birim), **Playwright** (Electron uçtan uca + PDF görsel regresyon) | |

Faz 2–3'te eklenecekler: `@notionhq/client`, `mermaid`, `pdfjs-dist`, `d3-force` (graf), `ts-fsrs` (aralıklı tekrar), `diff` (sürüm farkı).

---

## 3. Mimari

```
┌─────────────────────────── Electron ───────────────────────────┐
│  Ana süreç (Node)                                              │
│   ├─ window      : pencere, trafik ışıkları, vibrancy          │
│   ├─ vault       : dosya okuma/yazma (atomik), ağaç, izleme    │
│   ├─ search-index: kasa dizini (arka planda)                   │
│   ├─ pdf-export  : gizli pencere + printToPDF                  │
│   ├─ notion-import (F2), history (F2), backup (F2)             │
│   └─ secrets     : Keychain (safeStorage)                      │
│                                                                │
│  Köprü (preload, contextIsolation) — tipli IPC API             │
│                                                                │
│  Arayüz (React)                                                │
│   ├─ shell       : kenar çubuğu, sekmeler (F3), cam menüler    │
│   ├─ editor      : TipTap + özel bloklar                       │
│   ├─ smart-paste : saf fonksiyon (metin/HTML → blok ağacı)     │
│   ├─ markdown    : blok ağacı ⇄ Markdown                       │
│   └─ guide       : tanıtım turu, rehber, ipuçları              │
└────────────────────────────────────────────────────────────────┘
```

**Modül sınırları (her biri bağımsız test edilebilir):**

- `markdown` — `parse(md) → Doc` ve `serialize(Doc) → md`. Saf; DOM'a, Electron'a bağımlı değil. Temel değişmez kural: **round-trip kayıpsızdır** (`serialize(parse(x))` anlamsal olarak `x`'e eşit).
- `smart-paste` — `convertPaste({ text, html }) → { doc, warnings, suggestions }`. Saf. Editör sadece sonucu ekler.
- `vault` — dosya sistemi soyutlaması; arayüz sadece IPC üzerinden `listTree`, `readPage`, `writePage`, `movePage`, `createPage`, `deletePage` (çöp kutusuna), `saveAttachment` çağırabilir.
- `pdf-export` — `exportPdf(pageIds, options) → filePath`.
- Arayüz diske doğrudan erişemez (`nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`).

---

## 4. Kasa (dosya) formatı

```
~/Documents/Kernel/                 ← varsayılan; ayarlardan değiştirilebilir
  Lineer Cebir.md
  Lineer Cebir/                     ← "Lineer Cebir" sayfasının alt sayfaları
    Özdeğerler.md
    Determinant.md
  attachments/                      ← görseller, kapaklar, PDF'ler (benzersiz adlarla)
  .kernel/
    settings.json
    order.json                      ← kenar çubuğundaki elle sıralama
    search-index.json               ← önbellek; silinirse yeniden üretilir
    history/   (F2)
    templates/ (F2)
    srs.json   (F3)
```

**Sayfa dosyası:**

```markdown
---
id: 01JC8Z6Q3K7M2N4P5R6S7T8V9W      # kalıcı kimlik (ULID); linkler ve geçmiş buna bağlı
icon: "🧮"                          # emoji ya da attachments/… yolu
cover: attachments/cover-lineer.jpg # ya da hazır renk/desen adı: "kernel:teal-waves"
coverPosition: 0.42                 # kapağın dikey kaydırma oranı (0–1)
created: 2026-11-04T10:12:00Z
updated: 2026-11-04T11:40:00Z
tags: [vize]                        # (F3)
---

# Özdeğerler ve özvektörler
...
```

**Blok → Markdown eşlemesi** (Obsidian / GFM uyumlu; standart dışı her şey okunabilir bir sözdizimiyle saklanır):

| Blok | Markdown |
|---|---|
| Başlık 1–6 | `#` … `######` |
| Madde / numaralı / yapılacak listesi | `-`, `1.`, `- [ ]` |
| Alıntı | `>` |
| Callout | `> [!note] Başlık` (+ isteğe bağlı ikon: `> [!note|🧠]`) ve renk: `note, tip, warning, danger, info, example` |
| Toggle | `<details><summary>Başlık</summary>…</details>` |
| Kod | <code>```dil</code> |
| Blok formül | `$$ … $$` (ayrı satırlarda) |
| Satır içi formül | `$ … $` |
| Görsel | `![alt](attachments/x.png)` (+ genişlik: `![alt|600](…)`) |
| Tablo | GFM tablosu |
| Ayırıcı | `---` |
| Metin rengi / vurgu | `==vurgu==`; renkli olanlar `<mark data-color="yellow">…</mark>` |
| Sayfa linki (F3) | `[[Sayfa adı]]` / `[[Sayfa adı|görünen ad]]` |
| Mermaid (F2) | <code>```mermaid</code> |
| Gömülü PDF (F2) | `![[attachments/slayt.pdf]]` |
| Flashcard (F3) | `Soru :: Cevap` satırı; kart olarak işaretlenmiş toggle: `<details data-card>` |

**Dosya kuralları:**

- Sayfa adı = dosya adı (macOS'te geçersiz karakterler `/` ve `:` güvenli karakterlerle değiştirilir; ad çakışmasında ` (2)` eklenir).
- Yazma **atomik**: `x.md.tmp`'ye yaz → `fsync` → `rename`. Otomatik kayıt, son düzenlemeden 500 ms sonra.
- Silme, macOS Çöp Kutusu'na taşır (`shell.trashItem`); kalıcı silme yok.
- Dış değişiklik (chokidar): açık olmayan sayfa sessizce yenilenir. Açık ve kaydedilmemiş değişikliği olan sayfa için "Dosya dışarıda değişti — benimkini koru / diskteki sürümü yükle" seçimi sunulur.
- Alt sayfası olan bir sayfa taşındığında / adı değiştiğinde klasörü de birlikte taşınır.

---

## 5. Arayüz tasarımı — "Ada"

### Görsel dil

- **Zemin:** Gri-mavi `#DCE5EC` (koyu: `#141A20`). Kenar çubuğu macOS gerçek vibrancy (`vibrancy: 'sidebar'`) kullanır; masaüstü rengi hafifçe içinden görünür.
- **Sayfa:** Zemin üzerinde **yüzen kağıt**. 10 px iç boşluk, 14 px köşe yarıçapı, beyaz `#FFFFFF` (koyu: `#1C232B`).
- **Vurgu rengi:** Petrol yeşili `#0E7C6B` (koyu: `#3FBFA8`). Seçili öğe, link, odak halkası, birincil buton.
- **Liquid Glass:** Cmd+K, `/` blok menüsü, sağ tık menüleri, biçimlendirme araç çubuğu, tanıtım turu, ipuçları ve toast'lar yarı saydam cam yüzeylerdir: `backdrop-filter: blur(24px) saturate(180%)`, ince açık kenar çizgisi, üstten hafif parlama. Erişilebilirlik ayarında "Saydamlığı azalt" açıksa düz yüzeye düşer.
- **Pencere:** `titleBarStyle: 'hiddenInset'`; trafik ışıkları kenar çubuğunun içinde.

### Tipografi (Apple sistem fontları — uygulamaya gömülmez)

| Rol | Font | CSS |
|---|---|---|
| Arayüz | SF Pro | `-apple-system, BlinkMacSystemFont` |
| Not metni (varsayılan) | New York | `ui-serif` |
| Not metni (alternatif, ayarlardan) | SF Pro | `-apple-system` |
| Kod | SF Mono | `ui-monospace` |
| Formül | KaTeX fontları | (KaTeX ile gelir) |

Not metni satır uzunluğu en fazla ~72 karakter (sayfa genişliği ayarı: dar / normal / geniş).

### Ana ekran

```
┌──────────────┬──────────────────────────────────────────────┐
│ ● ● ●        │ ╭──────────────────────────────────────────╮ │
│ ⌕ Ara   ⌘K   │ │ ████████ kapak görseli ████████████████  │ │
│              │ │ [ikon]                                   │ │
│ Dersler      │ │ Özdeğerler ve özvektörler                │ │
│ ▾ Lineer C.  │ │                                          │ │
│   ▸ Özdeğer. │ │ metin…                                   │ │
│   ▸ Determ.  │ │        det(A − λI) = 0                   │ │
│ ▸ Veri Yap.  │ │ ┌ python ───────────────┐                │ │
│ ▸ Fizik II   │ │ │ vals, vecs = …        │                │ │
│              │ │ └───────────────────────┘                │ │
│ ? Rehber     │ ╰──────────────────────────────────────────╯ │
└──────────────┴──────────────────────────────────────────────┘
       (sağda, açılır-kapanır: içindekiler paneli)
```

- **Kenar çubuğu:** Arama, sayfa ağacı (sürükle-bırak, sağ tık menüsü: yeni alt sayfa, yeniden adlandır, ikon değiştir, Finder'da göster, PDF export, sil), altta Rehber ve Ayarlar. Daraltılabilir (Cmd+\\).
- **Sayfa başlığı alanı:** Üzerine gelince "İkon ekle" / "Kapak ekle" belirir. İkon seçici: emoji (arama destekli) + kendi görselin. Kapak seçici: hazır Kernel renk/desenleri, kendi görselin, kapağı sürükleyerek konumlandırma.
- **İçindekiler paneli:** Sağda, başlıklardan otomatik; tıklayınca o başlığa kayar, okunan bölüm vurgulanır.
- **`/` blok menüsü:** Tüm blok türleri, aranabilir.
- **Satır içi biçimlendirme araç çubuğu:** Metin seçince cam bir çubuk: kalın, italik, altı çizili, üstü çizili, kod, formül, link, renk/vurgu.
- **Blok tutamağı:** Satırın solunda ⋮⋮ — sürükle-bırak ile taşıma, tıklayınca blok menüsü (türe dönüştür, çoğalt, sil, renk).
- **Tema:** Açık / koyu / sistemi takip et.

### Logo — "Sayfa K"

Petrol yeşili yuvarlatılmış kare üzerinde köşesi kıvrık beyaz bir sayfa; sayfanın içinde petrol yeşili, yuvarlak uçlu bir **K**. macOS ikon ızgarasına uygun `.icns` (16–1024 px) olarak üretilir; ayrıca uygulama içinde (tanıtım turu, boş durumlar) tek renkli bir sürümü kullanılır. Koyu temada da aynı ikon kullanılır.

---

## 6. Editör ve bloklar (Faz 1)

Desteklenen bloklar: paragraf, başlık 1–6, madde / numaralı / yapılacak listesi (iç içe), toggle, callout (6 renk + ikon), alıntı, ayırıcı, tablo (satır/sütun ekleme, başlık satırı, hizalama), görsel (yapıştır / sürükle / dosyadan; yeniden boyutlandırma, alt yazı), kod bloğu, blok formül, satır içi formül.

- **Kod bloğu:** Sağ üstte dil seçici (aranabilir), kopyala butonu, satır numarası seçeneği, Shiki renklendirmesi (açık/koyu temaya uygun). Tab girintisi.
- **Formül bloğu:** Tıklayınca LaTeX düzenleme alanı açılır, altında canlı önizleme. Hatalı LaTeX kırmızı altı çizili + hata mesajı; blok bozuk görünmez, son geçerli render korunur.
- **Satır içi formül:** `$…$` yazınca otomatik dönüşür; tıklayınca küçük cam bir düzenleme baloncuğu.
- **Markdown kısayolları:** `# `, `- `, `1. `, `[] `, `> `, <code>```</code>, `$$`, `---` vb. yazarken otomatik blok dönüşümü.
- **Geri al / yinele:** Editör genelinde; akıllı yapıştırma tek adımda geri alınabilir.

---

## 7. Akıllı yapıştırma (`smart-paste`)

Kernel'in temel farkı. Saf fonksiyon: `convertPaste({ text, html }) → { doc, warnings, suggestions }`.

### Akış

1. **Kaynak seçimi:** Panoda HTML varsa ve içinde yapılandırılmış içerik varsa (KaTeX/MathJax işaretlemesi, `<pre><code class="language-…">`) HTML yolu kullanılır. Yoksa düz metin yolu.
2. **HTML yolu:** Render edilmiş formüllerden orijinal LaTeX çıkarılır (`<annotation encoding="application/x-tex">`, MathJax `data-*` / `<script type="math/tex">`). Kod bloklarının dili `class` adından alınır. Gerisi HTML → Markdown'a çevrilip düz metin yoluna verilir.
3. **Düz metin yolu (sıra önemlidir):**
   1. **Korumaya alma:** Çitli kod blokları (<code>```…```</code>, `~~~`) ve satır içi kod (`` `…` ``) yer tutucularla değiştirilir. Sonraki adımlar bunlara dokunmaz.
   2. **Kaçış normalizasyonu:** `\\(` `\\)` `\\[` `\\]` → `\(` `\)` `\[` `\]` (NotebookLM'in çift kaçışlı biçimi). Formül içi komutlara (`\vec`, `\text`, `\_` …) dokunulmaz.
   3. **Formül çıkarma — Markdown ayrıştırmasından önce:**
      - Blok: `$$…$$`, `\[…\]`, `\begin{equation|align|gather|matrix|pmatrix|bmatrix|cases|…}…\end{…}` → blok formül. Liste maddesi içindeki girintili blok formül, o maddenin içinde blok formül olarak kalır.
      - Satır içi: `\(…\)` ve `$…$`.
      - **Para birimi koruması (`$`):** Açılış `$`'dan sonra boşluk olmamalı, kapanış `$`'dan önce boşluk olmamalı ve kapanıştan sonra rakam gelmemeli; aynı satırda eşleşmeli.
      - Çıkarılan formüller de yer tutucuya alınır.
   4. **Ayraçsız LaTeX sezgisi:** Bir satırın büyük kısmı LaTeX komutlarından (`\frac`, `\sum`, `\int`, `\sqrt`, `^{`, `_{` …) oluşuyor ve düzyazı içermiyorsa → blok formül. Güven puanı eşiğin altındaysa dönüştürülmez; `suggestions` listesine "formüle çevir" önerisi olarak eklenir (editörde küçük bir çip olarak gösterilir).
   5. **Kaynak numarası temizliği** (varsayılan açık, ayarlardan kapatılabilir): Kelimeye ya da noktalamaya bitişik, yalnızca sayı içeren köşeli parantezler (`[1]`, `[2, 3]`, `[4-6]`) silinir. Korumalı bölgelere dokunulmaz; `[CLS]`, `[0, 0, ..., 1]` gibi ifadeler etkilenmez (zaten kod içinde ya da sayı dışı karakter içeriyorlar).
   6. **Markdown ayrıştırma:** remark (+ GFM: tablo, yapılacaklar, üstü çizili) ile.
   7. **Çitsiz kod sezgisi:** Ardışık ≥ 2 satır güçlü kod sinyali taşıyorsa (`;` ile biten satırlar, `{`/`}`, `def`/`class`/`import`/`#include`/`function`/`public static`, tutarlı girinti, düzyazı oranı düşük) → kod bloğu. 4 boşluk girintili bloklar → kod bloğu.
   8. **Yer tutucuların geri konması** ve blok ağacının üretilmesi.
4. **Kod dili tespiti:**
   - Etiket varsa normalize edilir: `py→python`, `js→javascript`, `ts→typescript`, `c++/cc/cxx→cpp`, `sh/shell/zsh→bash`, `md→markdown`, `yml→yaml`, `text/txt/plain→düz metin` …
   - Etiket yoksa highlight.js `highlightAuto` sınırlı bir dil listesiyle çalışır: python, c, cpp, java, javascript, typescript, sql, bash, html, css, json, yaml, markdown, matlab, r, go, rust, kotlin, swift, csharp, php. Güven düşükse düz metin.
   - <code>```md</code> / <code>```markdown</code> bloğu **render edilmez**; Markdown renklendirmeli kod bloğu olarak kalır.
   - <code>```text</code> bloğu düz metin kod bloğudur; kutu çizim karakterleri (`│ ├── └──`) SF Mono ile hizalı kalır.
5. **Doğrulama:** Her formül KaTeX ile `throwOnError` modunda denenir. Başarısız olursa formül metin olarak kalır ve `warnings`'e eklenir (editörde sarı işaret).
6. **Görseller:** Panodaki görsel dosyaları `attachments/`'a kaydedilir; HTML'deki uzak görseller indirilir (başarısız olursa link olarak kalır + uyarı).

### Kullanıcı kontrolü

- Yapıştırmadan hemen sonra **Cmd+Z** → yapıştırılan içerik ham metne döner (ikinci Cmd+Z tamamen geri alır).
- **Cmd+Shift+V** → doğrudan ham metin olarak yapıştırır.
- Ayarlar: kaynak numarası temizliği, ayraçsız LaTeX sezgisi, çitsiz kod sezgisi (her biri açılıp kapatılabilir).

### Test

- **Sentetik test seti (repoda):** NotebookLM, ChatGPT, Claude ve Gemini biçimlerini taklit eden, benim yazdığım örnekler. Kapsam: çift kaçışlı `\\(…\\)` / `\\[…\\]`, liste içi blok formül, `$` ve para birimi karışık metin, `\begin{align}`, ayraçsız LaTeX satırı, <code>```text</code> ağaç çizimi, etiketli / etiketsiz / çitsiz kod, <code>```md</code>, GFM tablo (hizalı), `- [x]`, h4–h5 başlıklar, emoji, kaynak numaraları, `[CLS]` / dizi içeren satır içi kod. Her örneğin beklenen çıktısı (blok ağacı + Markdown) snapshot olarak saklanır.
- **Özel test seti (repo dışında, gitignore'lu):** Kullanıcının gerçek NotebookLM çıktıları `test/fixtures/private/` altında. Aynı testler varsa bunları da çalıştırır; yoksa atlar.

---

## 8. PDF export

- **Motor:** Gizli bir `BrowserWindow`'da sayfa, baskı stil sayfasıyla render edilir → `webContents.printToPDF({ printBackground: true, generateDocumentOutline: true, displayHeaderFooter, footerTemplate, pageSize, margins })`.
- **Netlik:** Metin, formül (KaTeX fontları gömülü) ve kod vektöreldir. Görseller `attachments/` içindeki orijinal dosyadan tam çözünürlükte alınır (ekran görüntüsü / canvas yok). Görseller yüklenmeden ve fontlar hazır olmadan (`document.fonts.ready`) PDF üretimi başlamaz.
- **Sayfa kırılımı:**
  - Başlıklar: `break-after: avoid` (sayfa sonunda yalnız kalmaz).
  - Formül, görsel, callout, tablo satırı ve ≤ 25 satırlık kod blokları: `break-inside: avoid`.
  - Uzun kod blokları bölünebilir; devam sayfasında dil etiketi tekrarlanır.
  - Tablo başlık satırı her sayfada tekrarlanır (`thead { display: table-header-group }`).
- **Export penceresi:** A4 / Letter; kenar boşluğu (dar / normal / geniş); kapağı ilk sayfada göster; sayfa numarası; alt sayfaları dahil et (tek PDF, her sayfa yeni sayfadan başlar); tema (varsayılan açık).
- **Davranışlar:** Toggle'lar açık basılır; linkler tıklanabilir; PDF yan panelinde başlıklardan içindekiler (outline).
- **Test:** Örnek sayfalar PDF'e çevrilir → PDF, PNG'ye dönüştürülür (pdf.js) → referans görüntülerle piksel karşılaştırması (eşik ile). Değişiklik kaymaya yol açarsa test başarısız olur.

---

## 9. Arama (Faz 1)

- **Cmd+K:** Cam palet; sayfa adı (bulanık eşleşme) + tam metin içerik sonuçları, eşleşen parçanın vurgulu önizlemesi. Son açılan sayfalar boş sorguda listelenir.
- Türkçe normalizasyon: büyük/küçük harf ve `ı/i`, `ş/s`, `ğ/g`, `ç/c`, `ö/o`, `ü/u` eşdeğer kabul edilir.
- Dizin arka planda ana süreçte tutulur; dosya değişince artımlı güncellenir.

---

## 10. Notion aktarımı (Faz 2)

- **Sihirbaz:** Adım adım, görsellerle: (1) `notion.so/my-integrations` → yeni internal integration, (2) token'ı kopyala, (3) Notion'da ana sayfalarda "Connections → Kernel" ile paylaş, (4) token'ı Kernel'e yapıştır → bağlantı testi → bulunan sayfa listesi (seçilebilir) → aktar.
- **Token:** `safeStorage` ile macOS Keychain'de şifreli. Kasaya, ayarlara, loglara asla yazılmaz. Aktarım sonunda "token'ı sil" seçeneği.
- **Tarama:** `search` ile paylaşılan sayfalar; her sayfa için `blocks.children.list` özyinelemeli, sayfalı. İstek sınırı: saniyede en fazla 3 istek, 429 / 5xx'te üstel geri çekilmeli tekrar.
- **Eşleme:**

| Notion | Kernel |
|---|---|
| paragraph, heading_1–3, bulleted / numbered_list_item, to_do, quote, divider | doğrudan karşılığı |
| toggle, açılır başlık (`is_toggleable`) | toggle (açılır başlıkta başlık seviyesi korunur) |
| callout | callout (ikon + renk eşlemesi) |
| code | kod bloğu (dil korunur) |
| equation (blok) / rich text içi equation | blok / satır içi formül |
| image, file, pdf, video (dosya) | indirilip `attachments/`'a kaydedilir; görsel / dosya bağlantısı / gömülü PDF |
| bookmark, embed, link_preview, video (harici) | link kartı |
| table | GFM tablosu |
| child_page | alt sayfa (alt klasör) |
| child_database (az sayıda) | düz tablo (başlık satırı + özellik değerleri metin olarak) |
| synced_block | içerik yerinde kopyalanır |
| column_list | sütunlar alt alta dizilir + raporda not |
| link_to_page, sayfa bahsetmesi | `[[Sayfa adı]]` (F3'e kadar tıklanabilir iç link olarak çalışır) |
| rich text renkleri / arka plan renkleri, kalın, italik, kod, üstü çizili, altı çizili, link | karşılık gelen işaretler |
| sayfa ikonu (emoji / dosya / harici), kapak (dosya / harici / Notion galerisi) | frontmatter `icon`, `cover` (dosyalar indirilir) |
| desteklenmeyen tür | metin olarak yer tutucu + rapora eklenir |

- **Dosya linkleri 1 saatte geçersiz olduğu için** her dosya, bloğu okunduğu anda indirilir.
- **Hedef:** Kasada yeni bir `Notion içe aktarım (YYYY-MM-DD)` klasörü. Mevcut dosyaların üzerine asla yazılmaz.
- **Doğrulama raporu:** Sayfa başına Notion blok sayısı ↔ üretilen blok sayısı, indirilen / indirilemeyen dosyalar, desteklenmeyen bloklar (sayfa linkiyle). Rapor kasaya `Notion aktarım raporu.md` olarak da kaydedilir.
- **Test:** Notion API yanıtlarının kaydedilmiş sentetik örnekleriyle (gerçek kullanıcı verisi değil) birim testleri.

---

## 11. Faz 2'nin diğer özellikleri

- **Sürüm geçmişi:** Bir sayfa düzenlendikçe en fazla 5 dakikada bir anlık görüntü alınır: `.kernel/history/<id>/<zaman>.md`. Saklama: son 30 gün tamamı; 30 gün–1 yıl arası günde bir; sonrası silinir. Arayüz: sürüm listesi, yan yana fark görünümü, "Bu sürümü geri yükle" (geri yükleme de yeni bir sürüm oluşturur).
- **Otomatik yedekleme:** Seçilen klasöre (iCloud Drive, harici disk) günlük zip; son N (varsayılan 14) yedek tutulur. Elle "Şimdi yedekle".
- **Şablonlar:** `.kernel/templates/*.md`; "Şablondan yeni sayfa"; mevcut sayfayı şablon olarak kaydet. Değişkenler: `{{tarih}}`, `{{başlık}}`. Varsayılan bir "Ders notu" şablonu gelir.
- **Mermaid:** <code>```mermaid</code> blokları canlı diyagram olarak render edilir (kod / önizleme geçişi); PDF'te vektörel SVG. Akıllı yapıştırma `mermaid` etiketini tanır; etiketsiz ama `graph TD` / `sequenceDiagram` ile başlayan blokları da mermaid sayar.
- **Gömülü PDF:** `pdfjs-dist` tabanlı görüntüleyici; sayfa gezinme, yakınlaştırma; tam ekran / yan panelde açma.
- **Markdown / HTML export:** Markdown (görseller yanında bir klasörle, zip) ve tek dosya HTML (görseller gömülü, formüller KaTeX ile render edilmiş).

---

## 12. Faz 3: Bilgi ağı ve çalışma araçları

- **`[[` linkleri:** `[[` yazınca cam sayfa seçici. Linkler dosyada `[[Sayfa adı]]` olarak saklanır; çözümleme sayfa adına göre yapılır (aynı ada sahip birden fazla sayfa varsa yol ile ayırt edilir: `[[Lineer Cebir/Özdeğerler]]`). Sayfa yeniden adlandırılınca kasadaki tüm linkler güncellenir. Var olmayan sayfaya link → tıklayınca oluşturulur.
- **Geri bağlantılar:** Sayfanın altında "Bu sayfaya bağlananlar" paneli, bağlam cümlesiyle.
- **Graf görünümü:** `d3-force` ile tüm sayfalar ve linkler; yerel graf (sadece bu sayfanın komşuları) ve genel graf; etiket / klasöre göre renk; tıklayınca sayfaya git.
- **Etiketler:** Metin içinde `#etiket` + frontmatter `tags`. Kenar çubuğunda etiket paneli; etikete tıklayınca o etiketi taşıyan sayfalar.
- **Sekmeler ve bölünmüş ekran:** Cmd+tık yeni sekmede açar; Cmd+W sekmeyi kapatır; sekmeyi sayfanın sağına sürükleyince yan yana bölünür (en fazla 2 bölme). Açık sekmeler oturumlar arası hatırlanır.
- **Komut paleti (Cmd+P):** Tüm komutlar (yeni sayfa, export, tema, odak modu, çalışma ekranı…) kısayollarıyla listelenir.
- **Odak modu (Cmd+Shift+F):** Kenar çubuğu, içindekiler ve araç çubukları gizlenir; sadece sayfa kalır.
- **Flashcard'lar ve aralıklı tekrar:**
  - Kart kaynakları: tek satırda `Soru :: Cevap`; "kart olarak işaretle" ile toggle (başlık = soru, içerik = cevap; formül, kod ve görsel içerebilir).
  - Kart kimliği: sayfa id'si + kartın sorusunun normalize edilmiş özeti. Soru değişirse yeni kart sayılır; eski kartın verisi 30 gün tutulur.
  - Algoritma: **FSRS** (`ts-fsrs`). Değerlendirme: Tekrar / Zor / İyi / Kolay.
  - Çalışma ekranı: deste = sayfa, klasör (alt sayfalar dahil) ya da etiket; bugün vadesi gelen kart sayısı; sınav modu (vadeye bakmadan tüm kartlar, karışık).
  - Veri: `.kernel/srs.json`.

---

## 13. Rehber ve tanıtım

- **İlk açılış turu:** 4–5 kartlık cam pencere: kasanın yeri (ve değiştirme), akıllı yapıştırma, `/` blok menüsü, Cmd+K, PDF export. Atlanabilir; Rehber'den tekrar başlatılabilir.
- **Kernel Rehberi (Cmd+/ veya kenar çubuğunda ?):** Uygulama içi özel sayfa (kasaya yazılmaz). Her özellik için kısa açıklama + uygulamanın kendi bileşenleriyle çizilmiş **canlı mini örnek** (ör. çevrilebilen bir flashcard, yapıştırma öncesi/sonrası örneği, render edilen formül). Arama destekli **kısayol tablosu**.
- **Bağlamsal ipuçları:** Bir özellik ilk kez kullanıldığında tek seferlik cam baloncuk (ör. ilk `::` → "Bu satır bir flashcard oldu"). Ayarlardan kapatılabilir; görülme durumu `.kernel/settings.json`'da.
- **Fazlara göre büyür:** Her faz, eklediği özelliklerin rehber bölümlerini ve ipuçlarını da ekler.

### Kısayollar (başlangıç seti)

| Kısayol | İşlev |
|---|---|
| Cmd+N | Yeni sayfa |
| Cmd+Shift+N | Mevcut sayfanın altına yeni alt sayfa |
| Cmd+K | Ara / sayfaya git |
| Cmd+P | Komut paleti (F3) |
| Cmd+/ | Rehber |
| Cmd+\\ | Kenar çubuğunu aç/kapat |
| Cmd+Shift+T | İçindekiler panelini aç/kapat |
| Cmd+E | PDF olarak dışa aktar |
| Cmd+Shift+V | Ham metin olarak yapıştır |
| Cmd+B / I / U / Shift+S | Kalın / italik / altı çizili / üstü çizili |
| Cmd+Shift+M | Satır içi formül |
| Cmd+Alt+C | Kod bloğu |
| Cmd+Shift+F | Odak modu (F3) |
| Cmd+W / Cmd+T | Sekmeyi kapat / yeni sekme (F3) |
| Cmd+, | Ayarlar |

---

## 14. Hata yönetimi

- **Disk yazma hatası:** Toast + editörde "kaydedilmedi" göstergesi; içerik bellekte tutulur, 5 sn aralıklarla tekrar denenir; uygulamadan çıkarken kaydedilmemiş değişiklik varsa uyarır.
- **Bozuk / okunamayan Markdown dosyası:** Dosya asla değiştirilmez; sayfa salt okunur ham metin olarak açılır ve uyarı gösterilir.
- **Kasa klasörü bulunamazsa** (ör. harici disk takılı değil): Açılışta kasa seçme ekranı.
- **PDF export hatası:** Hangi görsel / formül yüzünden olduğu belirtilir; yarım PDF yazılmaz.
- **Notion aktarımı:** Ağ kesilirse kaldığı sayfadan devam edebilir (ilerleme durumu geçici olarak tutulur); her hata rapora girer, aktarım durmaz.
- **Uygulama çökmesi:** Yerel log dosyası `~/Library/Logs/Kernel/`. Uzak telemetri yok.

---

## 15. Test stratejisi

| Katman | Araç | Kapsam |
|---|---|---|
| `markdown` | Vitest | Her blok türü için parse / serialize; round-trip kayıpsızlık testleri |
| `smart-paste` | Vitest | Sentetik test seti (snapshot); özel set varsa o da |
| `vault` | Vitest (geçici klasör) | Atomik yazma, taşıma / yeniden adlandırma (alt klasörlerle), ad çakışması, dış değişiklik |
| `notion-import` | Vitest | Kaydedilmiş sentetik API yanıtları → beklenen Markdown + rapor |
| Uygulama | Playwright (Electron) | Sayfa oluşturma, yazma, yapıştırma, ikon/kapak, arama, export akışları |
| PDF | Playwright + pdf.js | Görsel regresyon (referans PNG'ler) |

Her fazın sonunda: tüm testler geçer, `.app` derlenir, kullanıcı elle dener, `git status` ile kasa / özel dosya sızıntısı olmadığı doğrulanır, sonra GitHub'a push edilir.

---

## 16. Fazlar ve teslimatlar

| Faz | İçerik | Teslimat |
|---|---|---|
| **1 — Çekirdek** | Electron iskeleti, logo ve `.app` paketi, kasa ve sayfa ağacı, editör ve tüm temel bloklar, akıllı yapıştırma, ikon ve kapak, Cmd+K arama, açık/koyu tema, otomatik kayıt, içindekiler paneli, PDF export, ilk açılış turu, Rehber (Faz 1 bölümleri) | Günlük kullanılabilir Kernel `.app`; GitHub'a ilk push |
| **2 — Taşınma ve güvence** | Notion aktarımı, sürüm geçmişi, otomatik yedekleme, Markdown/HTML export, şablonlar, Mermaid, gömülü PDF, Rehber bölümleri | Notion'dan tamamen geçiş; push |
| **3 — Bilgi ağı ve çalışma** | `[[linkler]]` ve geri bağlantılar, graf, etiketler, sekmeler ve bölünmüş ekran, komut paleti, odak modu, flashcard'lar ve FSRS, Rehber bölümleri | Tam özellikli Kernel; push |

Her faz kendi uygulama planıyla (writing-plans) ele alınır.

---

## 17. Kapsam dışı

- Çok kullanıcılı düzenleme, bulut senkronizasyonu, mobil uygulama.
- Notion veritabanlarının tam karşılığı (filtreli / sıralı görünümler, Kanban). Az sayıdaki tablo düz tabloya çevrilir.
- Yapay zekâ özellikleri (uygulama içi özetleme vb.).
- Eklenti sistemi (kod modüler tutulur ki ileride eklenebilsin, ama v1'de API sunulmaz).
- Windows / Linux paketleri.
- Apple Developer imzası / notarization (yerel kullanım için gerekmez; ilk açılışta "Sağ tık → Aç" yeterli). İleride eklenebilir.
