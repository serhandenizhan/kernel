# Kernel Faz 2 (Taşınma ve güvence) — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notion'daki tüm sayfaları eksiksiz aktarmak; sürüm geçmişi, otomatik yedek, şablonlar, Mermaid, gömülü PDF ve Markdown/HTML export ile Kernel'i Notion'un tam yerine geçirmek.

**Architecture:** Notion aktarımı ana süreçte çalışır: küçük, test edilebilir bir HTTP istemcisi (hız sınırı + tekrar deneme), sayfa ağacını tarayıp dosyaları anında indiren bir aktarıcı ve Notion bloklarını Kernel belgesine çeviren saf bir dönüştürücü (`src/core/notion`). Geçmiş ve yedek ana süreçte, kasanın `.kernel/` klasöründe ve kullanıcının seçtiği yedek klasöründe tutulur. Yeni bloklar (wiki link, gömülü PDF, Mermaid) Faz 1'deki Markdown şemasına eklenir; round-trip kayıpsızlık kuralı sürer.

**Tech Stack:** Faz 1 yığını + `diff` (sürüm farkı), `fflate` (zip), `mermaid` (diyagram), `pdfjs-dist` (görüntüleyici; zaten kurulu), Electron `safeStorage` (Keychain).

**Spec:** `docs/superpowers/specs/2026-11-04-kernel-design.md` — §10 (Notion aktarımı), §11 (Faz 2'nin diğerleri), §13 (rehber), §14 (hata yönetimi).

## Global Constraints

- **Kullanıcı notları ve Notion içeriği asla repoya girmez.** Notion test verileri yalnızca bu plan sırasında *sıfırdan yazılan* sentetik JSON'lardır; kullanıcının gerçek Notion çıktısı, sayfa adları ya da metinleri test dosyalarına kopyalanmaz. Her commit öncesi `npm run check:private` (Task 1) çalışır ve temiz olmalıdır.
- **Notion token'ı** yalnızca `safeStorage` ile şifrelenip `userData/notion-token.bin`'de durur; kasaya, ayarlara, loglara, hata mesajlarına, IPC olay yüklerine yazılmaz.
- **Aktarım mevcut dosyaların üzerine asla yazmaz**; her şey yeni `Notion içe aktarım (YYYY-MM-DD)` sayfasının altına gelir (aynı gün ikinci aktarım → `uniqueName` ile ` (2)`).
- Notion API: `https://api.notion.com/v1`, başlık `Notion-Version: 2022-06-28`; saniyede **en fazla 3 istek**; 429 ve 5xx'te üstel geri çekilme (`Retry-After` varsa ona uyulur), en fazla 5 deneme.
- Notion dosya linkleri **1 saatte** geçersizleşir: dosya, bloğu okunduğu anda indirilir.
- Sürüm geçmişi: en fazla **5 dakikada bir** anlık görüntü; **30 gün** tamamı, **30 gün–1 yıl** günde bir, sonrası silinir.
- Yedek: günlük zip, varsayılan son **14** yedek; ad `Kernel-yedek-YYYY-MM-DD-HHmm.zip`.
- Şablon değişkenleri: `{{tarih}}` (GG.AA.YYYY), `{{başlık}}`. Varsayılan şablon: "Ders notu".
- Faz 1 kuralları aynen: kod/tanımlayıcı İngilizce, yorumlar Türkçe, arayüz Türkçe; atomik yazma; TDD; push yalnızca kullanıcı onayıyla; testler yalnızca geçici klasör ve sentetik pano kullanır.

## Review Focus

1. **Aktarım yarıda kesilir (ağ kopar, 429 fırtınası, uygulama kapanır)** → "Devam et" ile kaldığı yerden sürer; aynı sayfa iki kez yazılmaz. Test: Task 10.
2. **İndirilemeyen dosya ya da süresi geçmiş link** → aktarım durmaz, rapora sayfa adıyla girer, sayfada link olarak kalır. Test: Task 10.
3. **Notion başlıkları**: boş ("Untitled"), `/`, `:`, emoji, aynı ebeveynde aynı ada sahip iki sayfa → "Adsız", güvenli ad, ` (2)`; sayfalar birbirine karışmaz, `[[link]]`ler doğru sayfaya gider. Test: Task 10.
4. **Sürüm geçmişi büyümesi ve geri yükleme**: sık kayıtta anlık görüntü yığılmaz; açık sayfada geri yükleme çakışma penceresi açmadan editörü yeniler. Test: Task 5.
5. **Yedek klasörü kasanın içinde ya da erişilemez** (harici disk takılı değil) → zip kendini içermez; hata toast'ı, uygulama çalışmaya devam eder. Test: Task 6.

---

## Dosya yapısı (yeni / değişen)

```
scripts/check-private-leak.mjs        ← repo ↔ test/fixtures/private örtüşme taraması
src/shared/types.ts                   ← HistoryEntry, BackupStatus, Notion* tipleri, KernelApi eklentileri, Settings.backup
src/core/markdown/{parse,serialize,schema}.ts   ← wikiLink, pdfEmbed, details{heading}
src/core/smart-paste/language.ts      ← mermaid tespiti
src/core/notion/
  types.ts        ← NotionBlock, NotionRichText, NotionPage (asgari tipler)
  rich-text.ts    ← richTextToInline
  convert.ts      ← convertBlocks, pageMeta, CALLOUT_COLOR_MAP, HIGHLIGHT_COLOR_MAP
src/main/
  notion/client.ts    ← NotionClient (fetch enjekte edilebilir; hız sınırı; tekrar)
  notion/importer.ts  ← NotionImporter (tarama, indirme, yazma, rapor, devam)
  secrets.ts          ← saveToken / loadToken / clearToken
  history.ts          ← HistoryStore
  backup.ts           ← makeBackup, BackupScheduler
  templates.ts        ← TemplateStore
  export.ts           ← exportMarkdownZip, exportHtml
src/renderer/
  editor/nodes/{WikiLink,PdfEmbed}.ts, editor/ui/{PdfEmbedView,MermaidView}.tsx
  shell/{HistoryPanel,TemplateMenu}.tsx, shell/ExportDialog.tsx (biçim seçimi)
  notion/ImportWizard.tsx
  print/PrintView.tsx (bekleyen render sayacı, HTML anlık görüntüsü)
test/fixtures/notion/*.json           ← SENTETİK API yanıtları
```

---

### Task 1: Özel not sızıntısı kontrolü

**Files:** Create `scripts/check-private-leak.mjs`; Modify `package.json` (script `check:private`), `CLAUDE.md`; Test `test/unit/scripts/leak.test.ts`

**Interfaces:**
- Produces: `npm run check:private` → çıkış kodu 0 (temiz) / 1 (örtüşme; dosya ve satır listesi stdout'a, özel içerik yazdırılmadan). `findOverlaps(privateTexts: string[], files: { path: string; text: string }[]): { path: string; line: number; kind: 'line' | 'phrase' }[]` dışa aktarılır.

Kural: normalize (`[\s*`#>\-|]+` → boşluk, küçük harf) edilmiş ≥ 18 karakterlik satır eşleşmesi **ya da** 6 kelimelik ortak ifade. Taranan: `git ls-files` (png/icns/package-lock hariç). Özel klasör yoksa 0 ile çıkar.

- [ ] **Step 1: Failing test**

```ts
expect(findOverlaps(['Gizli ders cümlesi burada yazıyor ve uzun'], [{ path: 'a.txt', text: 'x\n- **Gizli ders cümlesi burada yazıyor ve uzun**' }])).toEqual([{ path: 'a.txt', line: 2, kind: 'line' }])
expect(findOverlaps(['bir iki üç dört beş altı yedi'], [{ path: 'b.md', text: 'önce bir iki üç dört beş altı sonra' }])).toEqual([{ path: 'b.md', line: 1, kind: 'phrase' }])
expect(findOverlaps(['tamamen farklı bir metin'], [{ path: 'c.md', text: 'alakasız içerik' }])).toEqual([])
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS; `npm run check:private` → 0.
- [ ] **Step 5:** `CLAUDE.md`'ye "her commit öncesi `npm run check:private`" kuralını ekle. Commit: `chore: private-note leak check`.

---

### Task 2: Markdown şeması — wiki link, gömülü PDF, başlıklı toggle

Spec §10 (link_to_page → `[[Sayfa adı]]`, F3'e kadar tıklanabilir iç link), §11 (gömülü PDF `![[attachments/slayt.pdf]]`), §10 (açılır başlıkta seviye korunur).

**Files:** Modify `src/core/markdown/{parse,serialize,schema}.ts`, `src/renderer/editor/extensions.ts`; Create `src/renderer/editor/nodes/WikiLink.ts`; Test `test/unit/core/markdown/phase2.test.ts`, `test/e2e/wikilink.spec.ts`

**Interfaces:**
- Produces düğümler: `wikiLink{target: string, label: string | null}` (satır içi atom), `pdfEmbed{src: string}` (blok atom), `details{card: boolean, heading: number | null}`.
- Markdown: `[[Hedef]]`, `[[Hedef|Görünen]]` ↔ wikiLink; tek başına paragraf `![[yol.pdf]]` ↔ pdfEmbed (pdf olmayan `![[x]]` metin kalır); `<details data-heading="2">` ↔ heading: 2.
- `resolveWikiTarget(tree: TreeNode[], target: string): string | null` (`src/renderer/editor/nodes/WikiLink.ts`): başlık `foldKey` eşleşmesi; `A/B` biçiminde yol eşleşmesi; birden fazla eşleşmede ilk (ağaç sırası).

Kararlar: Kullanıcının yazdığı düz `[[x]]` metni wiki link'e dönüşmesin diye `\[` kaçışı `\=` gibi korunur (ESCAPED_LBRACKET, U+E001). Serileştirme ham `html` düğümüyle. Editörde wikiLink petrol yeşili, altı noktalı; tıklayınca `resolveWikiTarget` → `openPage`; bulunamazsa toast "Sayfa bulunamadı: X".

- [ ] **Step 1: Failing testler**

```ts
const cases = ['bkz. [[Özdeğerler]] ve [[Lineer Cebir/Determinant|det]]', '![[attachments/slayt ş.pdf]]', '<details data-heading="2">\n<summary>Açılır başlık</summary>\n\niçerik\n\n</details>']
// her biri için round-trip: kararlı + anlam korunur (Faz 1 roundtrip kalıbı)
expect(markdownToDoc('[[A|b]]').content![0]).toEqual({ type: 'paragraph', content: [{ type: 'wikiLink', attrs: { target: 'A', label: 'b' } }] })
expect(markdownToDoc('![[attachments/x.pdf]]').content![0]).toEqual({ type: 'pdfEmbed', attrs: { src: 'attachments/x.pdf' } })
it('yazılan düz [[x]] metni wiki link olmaz', () => { const d = docOf('dizi [[1, 2]] ve [[x]]'); expect(markdownToDoc(docToMarkdown(d))).toEqual(d) })
expect(resolveWikiTarget(tree, 'özdeğerler')).toBe(ozId); expect(resolveWikiTarget(tree, 'Lineer Cebir/Determinant')).toBe(detId); expect(resolveWikiTarget(tree, 'yok')).toBeNull()
// e2e: [[Fizik]] içeren sayfada linke tıkla → page-title "Fizik"
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS (Faz 1 testleri dahil).
- [ ] **Step 5:** Commit: `feat(core): wiki links, pdf embeds and heading toggles`.

---

### Task 3: Mermaid diyagramları

Spec §11.

**Files:** Modify `src/core/smart-paste/language.ts`, `src/renderer/editor/ui/CodeBlockView.tsx`, `src/renderer/print/PrintView.tsx`; Create `src/renderer/editor/ui/MermaidView.tsx`, `src/renderer/lib/mermaid.ts`; Test `test/unit/core/smart-paste/mermaid.test.ts`, `test/e2e/mermaid.spec.ts`, `test/pdf/mermaid.spec.ts`

**Interfaces:**
- Produces: `detectLanguage` etiketsiz kodda ilk dolu satır `^(graph|flowchart)\s+(TD|TB|LR|RL|BT)\b` ya da `^(sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|mindmap|journey)\b` ise `'mermaid'`; `normalizeLanguage('mermaid') === 'mermaid'`. `renderMermaid(code: string, id: string): Promise<{ svg: string } | { error: string }>` (`lib/mermaid.ts`, tembel yükleme, `securityLevel: 'strict'`, tema açık/koyuya göre). Yazdırma: `window.kernelPendingRenders` sayacı (artır/azalt) — PrintView hazır sinyalini sayaç 0 olana kadar bekletir.

Kararlar: `language === 'mermaid'` kod bloğunda üstte "Önizleme / Kod" anahtarı; varsayılan önizleme; hatalı diyagramda kırmızı hata metni ve kod görünür kalır. Salt okunur (PDF) modda yalnızca SVG (vektörel).

- [ ] **Step 1: Failing testler**: `detectLanguage('graph TD\n  A-->B')` → `'mermaid'`; e2e: <code>```mermaid</code> bloğu içeren sayfada `.mermaid-preview svg` görünür; hatalı sözdiziminde `.mermaid-error`; PDF testi: metin katmanında diyagram düğüm etiketi ("Başla") var ve sayfa görseli boş değil.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Commit: `feat: mermaid diagrams`.

---

### Task 4: Gömülü PDF görüntüleyici

Spec §11.

**Files:** Create `src/renderer/editor/nodes/PdfEmbed.ts`, `src/renderer/editor/ui/PdfEmbedView.tsx`, `src/renderer/lib/pdfjs.ts`; Modify `extensions.ts`, `slash-items.ts` (öğe "PDF"), `nodes/Image.ts` (drop: `application/pdf` → pdfEmbed), `src/renderer/styles/blocks.css`; Test `test/e2e/pdf-embed.spec.ts`

**Interfaces:**
- Consumes: Task 2 `pdfEmbed{src}`; `attachments.save`; `toVaultUrl`.
- Produces: `loadPdf(url: string): Promise<PDFDocumentProxy>` (`lib/pdfjs.ts`, worker `pdfjs-dist/build/pdf.worker.min.mjs?url`, `isEvalSupported: false`).

Kararlar: Blok: başlık çubuğu (dosya adı, sayfa `3 / 12`, ◀ ▶, −/+ yakınlaştırma %50–%300, "Büyüt" → tam pencere cam modal). Görünür sayfa canvas'a çizilir (`devicePixelRatio` ile net). PDF'te (salt okunur) dosya adlı bir kart basılır: "📄 slayt.pdf — gömülü PDF" (PDF içine PDF gömülmez). Bölünmüş ekranda açma Faz 3'e (sekmeler) bırakılır.

- [ ] **Step 1: Failing e2e**: kasada 2 sayfalı sentetik PDF (test sırasında `pdf-lib` olmadan: Electron `printToPDF` ile üretilmiş geçici PDF) + `![[attachments/deneme.pdf]]` sayfası → canvas görünür, `1 / 2`; ▶ → `2 / 2`; "Büyüt" modalı açılır/Escape ile kapanır; `/pdf` slash öğesiyle dosya seçince (setInputFiles) blok eklenir ve dosya `attachments/`'a yazılır.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Commit: `feat: embedded pdf viewer`.

---

### Task 5: Sürüm geçmişi

Spec §11.

**Files:** Create `src/main/history.ts`, `src/renderer/shell/HistoryPanel.tsx`; Modify `src/main/ipc-handlers.ts` (yazımdan sonra `history.snapshot`), `src/shared/{types,ipc}.ts`, `src/preload/index.ts`, `src/renderer/shell/PageTree.tsx` (sağ tık "Sürüm geçmişi"), `App.tsx` (overlay `'history'`); Test `test/unit/main/history.test.ts`, `test/e2e/history.spec.ts`

**Interfaces:**
- Produces:

```ts
export interface HistoryEntry { versionId: string /* "20261104T101500123" */; time: string /* ISO */; size: number }
class HistoryStore {
  constructor(root: string, now?: () => Date)          // testler zamanı enjekte eder
  snapshot(id: string, fileText: string, opts?: { force?: boolean }): Promise<boolean>  // 5 dk kuralı; yazıldıysa true
  list(id: string): Promise<HistoryEntry[]>             // yeniden eskiye
  read(id: string, versionId: string): Promise<string>  // dosya metni (frontmatter dahil)
  prune(id?: string): Promise<void>                     // saklama politikası
}
// KernelApi.history: { list(id): Promise<HistoryEntry[]>; read(id, versionId): Promise<string /* gövde markdown */>; restore(id, versionId): Promise<void> }
```

Kararlar: Klasör `.kernel/history/<id>/<versionId>.md`; anlık görüntü yazım *sonrası* dosya metnidir. `restore`: sürümün gövdesi + mevcut sayfanın meta'sı (`id` korunur) `vault.write` ile yazılır, ardından `snapshot(force)`; renderer sayfayı yeniden okur (autosave `reset`, çakışma penceresi açılmaz). Prune her `snapshot` sonrası o sayfa için ve açılışta tüm kasa için çalışır. Panel: solda sürüm listesi (göreli zaman "3 dk önce"), sağda `diffLines` ile yan yana fark (eklenen yeşil, silinen kırmızı), "Bu sürümü geri yükle".

- [ ] **Step 1: Failing testler**

```ts
// now enjekte: t0, t0+2dk, t0+6dk → snapshot sonuçları true, false, true; list uzunluğu 2
// force: t0+1dk force:true → true
// prune: 10 gün önceki 3 sürüm korunur; 40 gün önce aynı güne ait 3 sürümden yalnızca en yenisi kalır; 400 gün önceki silinir
// read(versionId) yazılan metni döner; bilinmeyen versionId → hata
// e2e: yaz (v1) → saat ilerlemiş gibi force snapshot (test IPC'si yok: HistoryStore'u 0 dk eşikle başlatan KERNEL_TEST_HISTORY_INTERVAL_MS=0 ortam değişkeni) → yeni metin yaz (v2) → panelden v1'i geri yükle → editör v1 metnini gösterir, dosya v1 gövdesi, liste 3 sürüm, çakışma penceresi YOK
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Commit: `feat: page version history`.

---

### Task 6: Otomatik yedekleme

Spec §11.

**Files:** Create `src/main/backup.ts`; Modify `src/main/ipc-handlers.ts`, `src/main/index.ts` (zamanlayıcı), `src/shared/types.ts` (`Settings.backup = { enabled: boolean; folder: string | null; keep: number }`, varsayılan `{ enabled: false, folder: null, keep: 14 }`), `SettingsDialog.tsx` (Yedekleme bölümü: aç/kapa, klasör seç, "Şimdi yedekle", son yedek zamanı); Test `test/unit/main/backup.test.ts`, `test/e2e/backup.spec.ts`

**Interfaces:**
- Produces: `makeBackup(root: string, folder: string, keep: number, now?: Date): Promise<string /* zip yolu */>`; `class BackupScheduler { constructor(getState: () => { root: string; settings: Settings }, onError: (msg: string) => void, now?: () => Date); tick(): Promise<'done' | 'skipped' | 'failed'>; start(intervalMs = 3_600_000): void; stop(): void }`; durum `.kernel/backup.json` `{ last: ISO | null }`; `KernelApi.backup: { now(): Promise<{ filePath: string }>; status(): Promise<{ last: string | null }>; chooseFolder(): Promise<string | null> }`.

Kararlar: Zip (`fflate.zipSync`, sıkıştırma 6) kasadaki her şeyi içerir; hariç: `.kernel/search-index.json`, `.kernel/backup.json`, yedek klasörü kasanın içindeyse o klasörün kendisi, `.tmp` dosyaları. Atomik yazım. `keep` aşılınca en eski `Kernel-yedek-*.zip` silinir (başka dosyalara dokunulmaz). `tick`: kapalıysa ya da son yedek < 24 saat ise `skipped`; klasör yoksa/yazılamıyorsa `onError` ("Yedek alınamadı: klasör bulunamadı") ve `failed`. Açılışta bir kez + saatte bir.

- [ ] **Step 1: Failing testler**

```ts
// makeBackup: zip içinde 'A.md', 'A/B.md', 'attachments/x.png' var; '.kernel/search-index.json' yok
// yedek klasörü kasa içinde (vault/Yedekler) → zip içinde 'Yedekler/' girdisi yok
// keep=2, 3 yedek → en eski silinir, klasördeki 'notlarım.txt' durur
// tick: enabled=false → 'skipped'; son yedek 2 saat önce → 'skipped'; 25 saat önce → 'done'; klasör yok → 'failed' ve onError çağrıldı
// e2e: Ayarlar → yedekleme aç → klasör (KERNEL_TEST_BACKUP_DIR ile diyalogsuz) → "Şimdi yedekle" → klasörde 1 zip, ayarlarda "Son yedek: az önce"
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Commit: `feat: automatic backups`.

---

### Task 7: Şablonlar

Spec §11.

**Files:** Create `src/main/templates.ts`, `src/renderer/shell/TemplateMenu.tsx`; Modify `ipc-handlers.ts`, `types.ts`, `preload`, `Sidebar.tsx` ("+" yanında ▾ → şablon listesi), `PageTree.tsx` (sağ tık "Şablon olarak kaydet"); Test `test/unit/main/templates.test.ts`, `test/e2e/templates.spec.ts`

**Interfaces:**
- Produces: `class TemplateStore { constructor(root: string, now?: () => Date); list(): Promise<string[]>; ensureDefault(): Promise<void>; render(name: string, title: string): Promise<{ markdown: string; meta: Partial<PageMeta> }>; saveFrom(markdown: string, meta: PageMeta, name: string): Promise<void> }`; `KernelApi.templates: { list(): Promise<string[]>; create(parentId: string | null, name: string): Promise<TreeNode>; saveAs(id: string, name: string): Promise<void> }`.

Kararlar: `.kernel/templates/<ad>.md`; `ensureDefault` klasör boşsa "Ders notu.md" yazar (gövde: `## Konu`, `## Önemli kavramlar`, `## Formüller`, `## Örnek sorular`, `> [!tip] Sınav notu` callout'u). `create`: sayfa başlığı `"<şablon adı> <tarih>"`, `{{tarih}}` → `GG.AA.YYYY`, `{{başlık}}` → sayfa başlığı; şablonun ikon/kapak meta'sı kopyalanır, `id/created/updated` yenilenir. `saveFrom` aynı adı ` (2)` ile çakışmasız yazar.

- [ ] **Step 1: Failing testler**: `ensureDefault` sonrası `list()` → `['Ders notu']`; `render('Ders notu', 'Fizik 04.11.2026')` gövdesi `{{` içermez ve `## Konu` içerir; `{{tarih}}` 2026-11-04 → `04.11.2026`; e2e: ▾ → "Ders notu" → yeni sayfa başlığı `Ders notu 04.11.2026` biçiminde, gövdede "Önemli kavramlar"; sağ tık "Şablon olarak kaydet" → listede yeni ad.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Commit: `feat: page templates`.

---

### Task 8: Markdown ve HTML export

Spec §11.

**Files:** Create `src/main/export.ts`; Modify `src/renderer/shell/ExportDialog.tsx` (biçim: PDF / Markdown (zip) / HTML), `src/renderer/print/PrintView.tsx` (`window.kernelSnapshotHtml()`), `ipc-handlers.ts`, `types.ts`, `preload`; Test `test/unit/main/export.test.ts`, `test/e2e/export-formats.spec.ts`

**Interfaces:**
- Produces: `exportMarkdownZip(vault: Vault, id: string, includeSubpages: boolean, target: string): Promise<string>`; `exportHtml(vault: Vault, id: string, options: PdfOptions, target: string): Promise<string>`; `KernelApi.exportAs: { markdown(id: string, includeSubpages: boolean): Promise<{ filePath: string } | { canceled: true }>; html(id: string, options: PdfOptions): Promise<{ filePath: string } | { canceled: true }> }`; testlerde `KERNEL_TEST_PDF_DIR` aynı klasörü kullanır.

Kararlar: Zip: sayfa(lar) kasadaki göreli yapılarıyla + gövdede/meta'da geçen `attachments/…` dosyaları (`%20` çözülerek); frontmatter korunur. HTML: PDF'teki gizli `#/print` penceresi açılır; `kernelSnapshotHtml()` tüm `document.styleSheets` kurallarını tek `<style>`a, CSS `url(...)` fontlarını ve `kernel-file://` görsellerini `data:` URI'lerine çevirip tek dosyalık HTML döner (betik yok). Mermaid SVG'leri satır içi kalır.

- [ ] **Step 1: Failing testler**: zip girdileri `['Fizik.md', 'Fizik/Ek.md', 'attachments/a b.png']` (alt sayfalı), alt sayfasız → `['Fizik.md', 'attachments/a b.png']`; HTML dosyası `class="katex"` içerir, `kernel-file://` ve `<script` içermez, görsel `src="data:image/png;base64,` ile başlar, boyutu > 0.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Commit: `feat: markdown zip and single-file html export`.

---

### Task 9: Token saklama ve Notion istemcisi

Spec §10 (token, hız sınırı, tekrar).

**Files:** Create `src/main/secrets.ts`, `src/main/notion/client.ts`, `src/core/notion/types.ts`; Test `test/unit/main/notion-client.test.ts`, `test/unit/main/secrets.test.ts`

**Interfaces:**
- Produces:

```ts
// secrets.ts — safeStorage enjekte edilebilir (testte sahte şifreleyici)
saveToken(token: string, store?: SecretStore): Promise<void>; loadToken(store?): Promise<string | null>; clearToken(store?): Promise<void>
interface SecretStore { encrypt(s: string): Buffer; decrypt(b: Buffer): string; file: string }
// client.ts
class NotionClient {
  constructor(token: string, opts?: { fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; now?: () => number; maxRetries?: number /* 5 */ })
  me(): Promise<{ workspaceName: string }>
  search(cursor?: string): Promise<{ results: NotionPage[]; next_cursor: string | null }>   // filter: page
  page(id: string): Promise<NotionPage>
  children(blockId: string, cursor?: string): Promise<{ results: NotionBlock[]; next_cursor: string | null }>
  queryDatabase(id: string, cursor?: string): Promise<{ results: NotionPage[]; next_cursor: string | null }>
  database(id: string): Promise<{ title: NotionRichText[]; properties: Record<string, { type: string }> }>
}
class NotionError extends Error { status: number; code: string }   // mesaj token içermez
```

Kararlar: Hız sınırı: son 3 isteğin zaman damgaları; 4. istek 1 sn penceresi dolana kadar `sleep`. 429/500/502/503/504: `Retry-After` (sn) ya da `500 * 2^deneme` ms, en fazla 5 deneme, sonra `NotionError`. 401 → `NotionError(code: 'unauthorized')`, tekrar yok. Token yalnızca `Authorization: Bearer` başlığında.

- [ ] **Step 1: Failing testler**

```ts
// sahte fetch + sahte saat: 7 ardışık istek → sleep çağrılarının toplamı ≥ 2000 ms (sn'de ≤3)
// 429 (Retry-After: 2) sonra 200 → sleep(2000) çağrıldı, sonuç döndü
// 6 kez 503 → NotionError status 503; toplam 6 istek
// 401 → NotionError code 'unauthorized', 1 istek; hata mesajı token'ı içermez
// children sayfalama: next_cursor ile 2 istek, start_cursor parametresi doğru
// secrets: save→load aynı; dosya içeriği düz metin token'ı içermez; clear→load null
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Commit: `feat(notion): rate-limited api client and keychain token storage`.

---

### Task 10: Notion dönüştürücü ve aktarıcı

Spec §10 eşleme tablosu, doğrulama raporu, devam.

**Files:** Create `src/core/notion/{rich-text,convert}.ts`, `src/main/notion/importer.ts`, `test/fixtures/notion/*.json` (sentetik: konu "Gezegenler" ve "Algoritmalar"); Test `test/unit/core/notion/convert.test.ts`, `test/unit/main/notion-importer.test.ts`

**Interfaces:**
- Consumes: Task 9 `NotionClient`; Task 2 düğümleri; `Vault`; `docToMarkdown`.
- Produces:

```ts
// core/notion
interface ConvertContext { file(url: string): string | null /* indirildiyse attachments yolu */; pageTitle(notionId: string): string | null; report(e: { kind: 'unsupported' | 'flattened' | 'file-failed'; detail: string }): void }
convertBlocks(blocks: NotionBlock[] /* children doldurulmuş */, ctx: ConvertContext): JSONContent[]
richTextToInline(rt: NotionRichText[], ctx: ConvertContext): JSONContent[]
pageMeta(page: NotionPage, ctx: ConvertContext): { icon?: string; cover?: string }
countBlocks(blocks: NotionBlock[]): number              // Notion tarafı (iç içe dahil)
countDocBlocks(doc: JSONContent): number                // Kernel tarafı blok düğümleri
// main/notion/importer.ts
interface ImportReport { rootPageId: string; pages: number; files: number; failedFiles: { page: string; url: string }[]; unsupported: { page: string; type: string }[]; notes: string[]; mismatches: { page: string; notion: number; kernel: number }[] }
type ImportProgress = { phase: 'scanning' | 'importing' | 'done' | 'error' | 'canceled'; pagesDone: number; pagesTotal: number; current?: string; report?: ImportReport; error?: string }
class NotionImporter {
  constructor(deps: { client: NotionClient; vault: Vault; download: (url: string, nameHint: string) => Promise<string | null>; today?: () => Date; onProgress: (p: ImportProgress) => void })
  run(rootIds: string[]): Promise<ImportReport>
  resume(): Promise<ImportReport | null>      // .kernel/notion-import.json varsa
  cancel(): void
}
```

Eşleme kararları (spec tablosu + ayrıntılar):
- Arka plan renkleri → `highlight{color}`: `yellow/orange→yellow`, `green→green`, `blue→blue`, `pink/red→pink`, `purple→purple`, `gray/brown→gray`; metin renkleri aynı tona highlight olarak (Kernel'de metin rengi işareti yok) — rapora "metin rengi vurguya çevrildi" notu bir kez.
- Callout rengi → tür: `green→tip`, `blue→info`, `yellow/orange→warning`, `red/pink→danger`, `purple→example`, diğer→`note`; ikon emoji ise korunur.
- `heading_n` + `is_toggleable` → `details{heading: n}`; `toggle` → `details`.
- `code.language` (`plain text`, `c++`, `shell`, `markdown`…) → `normalizeLanguage`.
- `child_page` → ayrı sayfa (alt klasör) + üst sayfada bulunduğu yere `[[Başlık]]` paragrafı.
- `child_database` → başlık + GFM tablo (ilk sütun başlık özelliği, sonra diğer özellikler alfabetik; değerler düz metin: tarih `GG.AA.YYYY`, checkbox `✓/✗`, select adı, çoklu seçim `, ` ile, kişi adı).
- `column_list` → sütunların blokları sırayla; rapora `flattened`.
- `synced_block` → `synced_from` varsa kaynak bloğun çocukları çekilir.
- `paragraph` vb. iç içe çocukları → hemen ardından gelen bloklar (düzleştirilir).
- `link_to_page` / sayfa mention → `wikiLink{target: başlık}`; tarih mention → `GG.AA.YYYY` metni; kişi mention → `@Ad`.
- `bookmark/embed/link_preview/video(external)` → `🔗 ` + link paragrafı.
- Görsel/dosya/pdf/video(dosya) → `download` (blok okunduğu anda) → `image` / link paragrafı / `pdfEmbed`; indirilemezse orijinal URL ile link + `file-failed`.
- Desteklenmeyen tür → paragraf `[Desteklenmeyen Notion bloğu: <tür>]` + `unsupported`.
- Başlık: boş → "Adsız"; `sanitizeTitle`/`uniqueName` (Faz 1).
- Aktarıcı akışı: (1) kök sayfaları ve tüm alt sayfaları tara (`pagesTotal`), Notion id → başlık haritası; (2) kök: kasada `Notion içe aktarım (YYYY-MM-DD)` sayfası (aynı gün varsa ` (2)`); (3) her sayfa: blokları özyinelemeli çek, dosyaları anında indir, dönüştür, `vault.create` + `vault.write`; (4) durum dosyasına `{ notionId: kernelId }` ekle (her sayfadan sonra); (5) sonunda kök sayfa gövdesi özet, alt sayfa "Notion aktarım raporu" ayrıntılar; durum dosyası silinir. `resume`: durum dosyasındaki sayfaları atlar. `cancel`: o anki sayfadan sonra durur, durum dosyası kalır.

- [ ] **Step 1: Failing dönüştürücü testleri** (sentetik JSON fixture'larıyla): her eşleme satırı için beklenen JSONContent; renk eşlemeleri; `countBlocks` iç içe sayım; desteklenmeyen blok raporu.
- [ ] **Step 2: Failing aktarıcı testleri** (sahte `NotionClient` sınıfı fixture'lardan yanıt verir; geçici kasa):

```ts
// 3 sayfalık ağaç (kök + 2 alt, biri aynı ada sahip "Mars" kardeşi) → kasada 'Notion içe aktarım (2026-11-04)/Gezegenler.md', '.../Gezegenler/Mars.md', '.../Gezegenler/Mars (2).md'
// [[Mars]] linkleri doğru sayfaya: resolveWikiTarget ile kimlik eşleşir
// boş başlık → 'Adsız.md'; '/' içeren başlık → '∕'
// indirilemeyen görsel → rapor failedFiles 1, sayfada orijinal URL'li link, aktarım tamamlandı
// 2. sayfada client hata fırlatır → run reddedilir, durum dosyası 1 sayfa içerir; resume → kalan sayfalar yazılır, toplam dosya sayısı 3 (tekrar yok)
// aynı gün ikinci run → 'Notion içe aktarım (2026-11-04) (2)'; ilk aktarımdaki dosyalar değişmedi (mtime aynı)
// rapor sayfası mevcut ve 'Desteklenmeyen' bölümü listeler
```
- [ ] **Step 3:** FAIL → **Step 4:** uygula → **Step 5:** PASS. Commit: `feat(notion): block converter and resumable importer`.

---

### Task 11: Notion aktarım sihirbazı

Spec §10 sihirbaz.

**Files:** Create `src/renderer/notion/ImportWizard.tsx`; Modify `ipc-handlers.ts` (`notion:*` kanalları, `download` uygulaması: `fetch` → `vault.saveAttachment`, 30 sn zaman aşımı, 50 MB sınır), `preload`, `types.ts`, `Sidebar.tsx` (alt kısımda "Notion'dan aktar"), `SettingsDialog.tsx` ("Notion bağlantısını sil"), `App.tsx` (overlay `'notion'`, açılışta yarım aktarım varsa "Devam et" bandı); Test `test/e2e/notion-wizard.spec.ts`

**Interfaces:**
- Produces: `KernelApi.notion: { connect(token: string): Promise<{ ok: true; workspace: string } | { ok: false; error: string }>; connected(): Promise<boolean>; disconnect(): Promise<void>; pages(): Promise<{ id: string; title: string; icon?: string; parentTitle?: string }[]>; start(ids: string[]): Promise<void>; resume(): Promise<void>; cancel(): Promise<void>; pendingResume(): Promise<boolean>; onProgress(cb: (p: ImportProgress) => void): () => void }`. Test modu: `KERNEL_TEST_NOTION_FIXTURES=<klasör>` ayarlıysa ana süreç gerçek API yerine fixture'lardan yanıt veren sahte istemciyi kullanır (Task 10'daki sahte sınıf `src/main/notion/fixture-client.ts`'e taşınır).

Kararlar: Adımlar (cam modal, ilerleme noktaları): (1) Hazırlık — 3 adımlık görselli anlatım (`notion.so/my-integrations` → "New integration" → token'ı kopyala; Notion'da sayfada "•••" → "Connections" → integration'ı seç); (2) Token yapıştır (parola alanı) → "Bağlan" → çalışma alanı adı; (3) Sayfa listesi (onay kutuları, hepsini seç); (4) İlerleme çubuğu (`pagesDone / pagesTotal`, o anki sayfa), "Durdur"; (5) Rapor özeti (sayfa, dosya, sorun sayıları) + "Raporu aç" + "Token'ı sil" anahtarı (varsayılan açık).

- [ ] **Step 1: Failing e2e** (fixture istemcisiyle): sihirbaz → token "secret_test" → "Bağlan" → çalışma alanı adı görünür → 2 sayfa seç → aktar → ilerleme 3/3 → rapor; kenar çubuğunda "Notion içe aktarım (…)" ağacı; ayarlar → bağlantıyı sil → `connected()` false; `userData/notion-token.bin` silinmiş; kasa ve log dosyalarında "secret_test" geçmiyor.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Commit: `feat(notion): import wizard`.

---

### Task 12: Rehber, ipuçları ve kısayollar (Faz 2 bölümleri)

Spec §13.

**Files:** Modify `src/renderer/guide/{GuidePage,shortcuts,tips}.tsx`; Test `test/e2e/guide.spec.ts`, `test/unit/renderer/shortcuts.test.ts`

Kararlar: Rehbere bölümler: "Notion'dan aktarma" (sihirbazı açan buton), "Sürüm geçmişi ve yedek", "Şablonlar", "Diyagram ve PDF" (canlı Mermaid demosu). Yeni ipucu `first-history` (geçmiş paneli ilk açıldığında). Yeni Faz 2 kısayolu yok; `SHORTCUTS` değişmez (test bunu doğrular).

- [ ] **Step 1: Failing testler**: rehberde 4 yeni bölüm başlığı; Mermaid demosunda `svg`; "Notion'dan aktar" butonu sihirbazı açar.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Commit: `feat: phase 2 guide sections`.

---

### Task 13: Faz 2 kapanışı

- [ ] **Step 1:** `npm test && npm run test:e2e && npx playwright test test/pdf` → hepsi PASS; `npm run check:private` → 0.
- [ ] **Step 2:** `npm run dist`; paketlenmiş uygulamayla duman testi (geçici kasa, fixture Notion istemcisi).
- [ ] **Step 3:** README'ye Faz 2 özellikleri ve "Notion'dan geçiş" bölümü; `CLAUDE.md` güncel.
- [ ] **Step 4:** Commit: `docs: phase 2 wrap-up`.
- [ ] **Step 5:** Bağımsız tam dal incelemesi; bulgular düzeltilir.
- [ ] **Step 6:** **Kullanıcıya sor**, onayla: `main`'e birleştir, push, `v0.2.0` etiketi; yeni `.app`'i Uygulamalar'a kopyala.
- [ ] **Step 7:** Kullanıcıyla gerçek aktarım: kullanıcı kendi token'ını sihirbaza girer (token'ı asistan görmez/yazmaz), rapor birlikte incelenir; sorun çıkan blok türleri için yeni sentetik fixture + düzeltme.
