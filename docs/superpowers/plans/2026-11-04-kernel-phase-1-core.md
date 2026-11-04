# Kernel Faz 1 (Çekirdek) — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Günlük kullanılabilir Kernel `.app` sürümü: Markdown kasası, blok editör, akıllı yapıştırma, ikon ve kapak, arama, PDF export, tanıtım turu ve rehber.

**Architecture:** Electron ana süreci kasayı (düz `.md` dosyaları) yönetir ve tipli bir IPC API'si (`window.kernel`) sunar. React arayüzü TipTap editörü kullanır. Markdown ⇄ editör dönüşümü ve akıllı yapıştırma, `src/core/` altında DOM'a bağımlı olmayan saf modüllerdir; Node'da Vitest ile test edilir. PDF, arayüzün kendi salt okunur "print" görünümünün gizli bir pencerede `printToPDF` ile basılmasıyla üretilir.

**Tech Stack:** Electron 45, electron-vite 6, React 19, TypeScript (strict), TipTap 3, KaTeX, Shiki + prosemirror-highlight, highlight.js (dil tespiti), unified/remark (remark-parse, remark-gfm, remark-math, remark-frontmatter, remark-stringify), yaml, Zustand, MiniSearch, chokidar, electron-builder, Vitest, Playwright, pdfjs-dist + @napi-rs/canvas + pixelmatch (PDF görsel testi), sharp (ikon üretimi).

**Spec:** `docs/superpowers/specs/2026-11-04-kernel-design.md` (her görevde ilgili bölüm numarası verildi; yürütücü spec'i de okur).

## Global Constraints

- **Kullanıcı notları asla repoya girmez.** Varsayılan kasa `~/Documents/Kernel`. Testler yalnızca `os.tmpdir()` altında geçici kasalar kullanır. Her commit öncesi `git status` ile `.md` / görsel sızıntısı kontrol edilir. `test/fixtures/private/` gitignore'ludur.
- **Push yalnızca kullanıcı onayıyla** yapılır (Görev 20).
- Kod, dosya adları ve tanımlayıcılar İngilizce; **kod yorumları Türkçe**; arayüz metinleri Türkçe.
- `CLAUDE.md` her görevde güncel tutulur (mimari, komutlar, kurallar).
- Güvenlik: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Arayüz diske yalnızca `window.kernel` üzerinden erişir.
- Platform: macOS arm64. Pencere: `titleBarStyle: 'hiddenInset'`, `vibrancy: 'sidebar'`, `visualEffectState: 'followWindow'`.
- Renkler (spec §5): zemin `#DCE5EC` / koyu `#141A20`; sayfa `#FFFFFF` / koyu `#1C232B`; vurgu `#0E7C6B` / koyu `#3FBFA8`. Sayfa: 10 px iç boşluk, 14 px köşe.
- Fontlar (spec §5): arayüz `-apple-system, BlinkMacSystemFont`; not metni varsayılan `ui-serif` (alternatif `-apple-system`); kod `ui-monospace`.
- Liquid Glass: `backdrop-filter: blur(24px) saturate(180%)`; `prefers-reduced-transparency: reduce` olduğunda düz yüzey.
- Otomatik kayıt: son düzenlemeden 500 ms sonra; yazma atomik (`.tmp` → `fsync` → `rename`); silme `shell.trashItem`.
- Lisans: MIT. Telemetri yok; log `~/Library/Logs/Kernel/`.

## Review Focus

1. **Sayfa adlarında `/` ve `:`, Türkçe karakterler ve büyük/küçük harf çakışması** (APFS varsayılan olarak büyük/küçük harfe duyarsızdır; "Fizik" ve "fizik" aynı dosyadır) → güvenli ad üretilir, çakışmada ` (2)` eklenir. Test: Görev 3.
2. **Hızlı yazıp hemen Cmd+Q** → son karakter dahil kaydedilmiş olmalı. Test: Görev 10 (e2e).
3. **NFD dosya adları** (Finder'da oluşturulmuş `Özdeğerler.md` NFD olabilir) → başlıklar NFC'ye normalize edilir, arama ve linkler bozulmaz. Test: Görev 4.
4. **Düz metindeki `$`** (kullanıcı "5$ ile 10$" yazar) → kaydedilip yeniden açılınca formüle dönüşmez. Test: Görev 6.
5. **Boşluk / Türkçe karakter içeren ek dosya adları** (`attachments/Ekran Görüntüsü ş.png`) → editörde ve PDF'te görünür. Test: Görev 5 ve Görev 17.

---

## Dosya yapısı

```
package.json  electron.vite.config.ts  electron-builder.yml  tsconfig.json
tsconfig.node.json  tsconfig.web.json  vitest.config.ts  playwright.config.ts
CLAUDE.md  README.md  LICENSE
build/icon.svg  build/icon.icns            ← logo kaynağı ve üretilmiş ikon
scripts/make-icon.mjs
src/shared/
  types.ts            ← PageMeta, TreeNode, PageData, SearchHit, PdfOptions, Settings, KernelApi
  ipc.ts              ← IPC kanal adları (sabitler)
src/core/             ← SAF modüller (Node + tarayıcı; Electron/DOM bağımlılığı yok)
  normalize-tr.ts
  markdown/
    parse.ts          ← markdownToDoc(md): JSONContent
    serialize.ts      ← docToMarkdown(doc): string
    html-blocks.ts    ← <details>, <mark>, <u> gruplama yardımcıları
  smart-paste/
    index.ts          ← convertPaste(input): PasteResult
    protect.ts        ← kod bölgelerini yer tutucuya alma / geri koyma
    escapes.ts        ← \\( → \( normalizasyonu
    math.ts           ← formül çıkarma ($, $$, \(\), \[\], \begin{})
    latex-line.ts     ← ayraçsız LaTeX sezgisi (güven puanı)
    citations.ts      ← kaynak numarası temizliği
    code-detect.ts    ← çitsiz kod sezgisi
    language.ts       ← dil etiketi normalizasyonu + otomatik tespit
    html.ts           ← HTML → Markdown (LaTeX annotation çıkarma)
src/main/
  index.ts            ← uygulama yaşam döngüsü
  window.ts           ← createMainWindow(), kapanırken flush protokolü
  config.ts           ← userData/config.json (kasa yolu)
  vault/
    names.ts          ← sanitizeTitle, uniqueName
    frontmatter.ts    ← splitFrontmatter, joinFrontmatter
    atomic.ts         ← writeAtomic
    vault.ts          ← Vault sınıfı
    order.ts          ← .kernel/order.json
    watcher.ts        ← chokidar → olaylar
    settings.ts       ← .kernel/settings.json
  protocol.ts         ← kernel-file:// (yalnızca kasa içi)
  search.ts           ← SearchIndex (MiniSearch)
  pdf.ts              ← exportPdf
  ipc-handlers.ts
src/preload/index.ts  ← contextBridge: window.kernel
src/renderer/
  index.html  main.tsx  App.tsx  router.ts (#/ ve #/print)
  styles/tokens.css glass.css app.css editor.css print.css
  state/store.ts
  shell/ Sidebar.tsx PageTree.tsx VaultPicker.tsx PageHeader.tsx IconPicker.tsx
         CoverPicker.tsx TocPanel.tsx SearchPalette.tsx ExportDialog.tsx
         SettingsDialog.tsx Toasts.tsx ConflictDialog.tsx
  editor/ Editor.tsx extensions.ts autosave.ts paste.ts
          nodes/ Callout.ts Details.ts MathBlock.ts MathInline.ts CodeBlock.ts
                 Image.ts MarkColor.ts PasteSuggestion.ts
          ui/ SlashMenu.tsx BubbleToolbar.tsx BlockHandle.tsx CodeBlockView.tsx
              MathView.tsx ImageView.tsx
  print/PrintView.tsx
  guide/ Tour.tsx GuidePage.tsx shortcuts.ts tips.ts demos/*.tsx
test/
  unit/…              ← Vitest (src yapısını izler)
  fixtures/paste/     ← sentetik yapıştırma örnekleri (*.input.txt, *.input.html, *.expected.md)
  fixtures/private/   ← (gitignore) kullanıcının gerçek örnekleri
  e2e/…               ← Playwright (Electron)
  pdf/…               ← PDF görsel regresyon + referans PNG'ler
```

**Belge modeli kararı:** Sayfa başlığı = dosya adı; gövde Markdown'ı başlığı **H1 olarak tekrar etmez** (spec §4'teki örnekteki `# …` satırı gösterim amaçlıdır). Editörde başlık, gövdeden ayrı bir alandır.

---

### Görev 1: Proje iskeleti ve güvenli pencere

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `playwright.config.ts`, `src/main/index.ts`, `src/main/window.ts`, `src/preload/index.ts`, `src/renderer/{index.html,main.tsx,App.tsx}`, `CLAUDE.md`, `LICENSE` (MIT)
- Test: `test/e2e/launch.spec.ts`

**Interfaces:**
- Produces: `createMainWindow(): BrowserWindow`; npm script'leri `dev`, `build`, `test` (vitest run), `test:e2e` (önce build, sonra playwright), `dist`.

- [ ] **Step 1:** `npm create electron-vite@latest . -- --template react-ts` ile iskeleti kur (mevcut `.gitignore` ve `docs/` korunur), TS `strict: true`. Vitest ve Playwright'ı ekle.
- [ ] **Step 2: Failing e2e testi yaz**

```ts
test('pencere güvenli ayarlarla açılır', async () => {
  const app = await electron.launch({ args: ['out/main/index.js'], env: { KERNEL_VAULT: tmpVault() } })
  const win = await app.firstWindow()
  expect(await win.title()).toBe('Kernel')
  const prefs = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences())
  expect(prefs).toMatchObject({ contextIsolation: true, nodeIntegration: false, sandbox: true })
  expect(await win.evaluate(() => typeof (window as any).require)).toBe('undefined')
  await app.close()
})
```
`KERNEL_VAULT` ortam değişkeni testlerde kasa yolunu belirler (Görev 5'te kullanılır).

- [ ] **Step 3:** `npm run test:e2e` → FAIL.
- [ ] **Step 4:** `createMainWindow` yaz: 1280×820, min 900×600, `titleBarStyle: 'hiddenInset'`, `trafficLightPosition: { x: 18, y: 18 }`, `vibrancy: 'sidebar'`, `visualEffectState: 'followWindow'`, `backgroundColor: '#00000000'`, güvenlik ayarları; `<title>Kernel</title>`. Dış linkler `shell.openExternal` ile açılır, pencere içi navigasyon engellenir (`will-navigate`, `setWindowOpenHandler`). Log: `app.setAppLogsPath()` → `~/Library/Logs/Kernel/main.log`; `src/main/log.ts` içinde `log.info/warn/error` (yakalanmamış hatalar da yazılır).
- [ ] **Step 5:** `npm run test:e2e` → PASS.
- [ ] **Step 6:** `CLAUDE.md` yaz (amaç, komutlar, Global Constraints özeti, "notlar repoya girmez" kuralı). Commit: `chore: scaffold electron app with secure window`.

---

### Görev 2: Paylaşılan tipler ve Türkçe normalizasyon

**Files:**
- Create: `src/shared/types.ts`, `src/shared/ipc.ts`, `src/core/normalize-tr.ts`
- Test: `test/unit/core/normalize-tr.test.ts`

**Interfaces:**
- Produces (diğer tüm görevler bunları kullanır):

```ts
export interface PageMeta { id: string; icon?: string; cover?: string; coverPosition?: number; created: string; updated: string; tags?: string[] }
export interface TreeNode { id: string; title: string; path: string /* kasaya göre, örn. "Lineer Cebir/Özdeğerler.md" */; icon?: string; children: TreeNode[] }
export interface PageData { id: string; title: string; path: string; meta: PageMeta; markdown: string }
export interface SearchHit { id: string; title: string; path: string; snippet: string; score: number }
export interface PdfOptions { pageSize: 'A4' | 'Letter'; margin: 'narrow' | 'normal' | 'wide'; showCover: boolean; pageNumbers: boolean; includeSubpages: boolean; theme: 'light' | 'dark' }
export interface Settings { theme: 'system' | 'light' | 'dark'; bodyFont: 'serif' | 'sans'; pageWidth: 'narrow' | 'normal' | 'wide'; paste: { stripCitations: boolean; latexLineHeuristic: boolean; unfencedCodeHeuristic: boolean }; tips: { enabled: boolean; seen: string[] }; tourDone: boolean }
export const DEFAULT_SETTINGS: Settings // theme 'system', bodyFont 'serif', pageWidth 'normal', paste hepsi true, tips { enabled: true, seen: [] }, tourDone false
export interface KernelApi {
  vault: { info(): Promise<{ path: string } | null>; choose(): Promise<{ path: string } | null>; reveal(id: string): Promise<void> }
  pages: { tree(): Promise<TreeNode[]>; read(id: string): Promise<PageData>; write(id: string, input: { markdown: string; meta: PageMeta }): Promise<{ updated: string }>; create(parentId: string | null, title?: string): Promise<TreeNode>; rename(id: string, title: string): Promise<TreeNode>; move(id: string, parentId: string | null, index: number): Promise<void>; trash(id: string): Promise<void> }
  attachments: { save(bytes: Uint8Array, ext: string, nameHint?: string): Promise<string /* "attachments/…" */>; fetchRemote(url: string): Promise<string | null> }
  search: { query(q: string, limit?: number): Promise<SearchHit[]>; recent(): Promise<TreeNode[]> }
  pdf: { export(id: string, options: PdfOptions): Promise<{ filePath: string } | { canceled: true }> }
  settings: { get(): Promise<Settings>; set(patch: Partial<Settings>): Promise<Settings> }
  app: { onFlushRequest(cb: () => Promise<void>): void }
  events: { onTreeChanged(cb: () => void): () => void; onPageChangedExternally(cb: (id: string) => void): () => void }
}
export function normalizeTr(s: string): string
```

- [ ] **Step 1: Failing test**

```ts
expect(normalizeTr('IŞIK Ağacı')).toBe('isik agaci')
expect(normalizeTr('İstanbul ÇÖĞÜŞ')).toBe('istanbul cogus')
expect(normalizeTr('Özdeğerler')).toBe('ozdegerler') // NFD girdi
```
- [ ] **Step 2:** Çalıştır → FAIL.
- [ ] **Step 3:** `normalizeTr`: `normalize('NFC')` → `toLocaleLowerCase('tr')` → `ı→i ş→s ğ→g ç→c ö→o ü→u` → kalan birleşik işaretleri sil (`normalize('NFD').replace(/\p{M}/gu, '')`).
- [ ] **Step 4:** PASS. Commit: `feat: add shared types and turkish normalization`.

---

### Görev 3: Kasa yardımcıları — adlar, frontmatter, atomik yazma

Spec §4.

**Files:**
- Create: `src/main/vault/names.ts`, `src/main/vault/frontmatter.ts`, `src/main/vault/atomic.ts`
- Test: `test/unit/main/vault/{names,frontmatter,atomic}.test.ts`

**Interfaces:**
- Produces:
  - `sanitizeTitle(title: string): string` — NFC; `/` → `∕` (U+2215), `:` → `꞉` (U+A789); baştaki `.` kaldırılır; boşsa `"Adsız"`; en fazla 120 karakter.
  - `uniqueName(dir: string, base: string, ext: '.md' | '', taken?: Set<string>): Promise<string>` — klasördeki adlarla **büyük/küçük harfe duyarsız ve NFC** karşılaştırır; çakışmada `"Ad (2)"`, `"Ad (3)"`…
  - `splitFrontmatter(text: string): { meta: Record<string, unknown>; body: string }` ve `joinFrontmatter(meta: PageMeta, body: string): string` (`yaml` paketi; alan sırası: id, icon, cover, coverPosition, created, updated, tags; tanımsız alanlar yazılmaz).
  - `writeAtomic(file: string, data: string | Uint8Array): Promise<void>`.

- [ ] **Step 1: Failing testler**

```ts
expect(sanitizeTitle('Fizik / Lab: 1')).toBe('Fizik ∕ Lab꞉ 1')
expect(sanitizeTitle('   ')).toBe('Adsız')
// dir içinde "Fizik.md" var:
expect(await uniqueName(dir, 'fizik', '.md')).toBe('fizik (2)')
expect(await uniqueName(dir, 'Kimya', '.md')).toBe('Kimya')
const t = joinFrontmatter({ id: '01J', icon: '🧮', created: c, updated: u }, 'Merhaba\n')
expect(splitFrontmatter(t)).toEqual({ meta: { id: '01J', icon: '🧮', created: c, updated: u }, body: 'Merhaba\n' })
expect(splitFrontmatter('frontmatter yok')).toEqual({ meta: {}, body: 'frontmatter yok' })
// atomic: yazma sırasında hata simülasyonu → hedef dosya eski içeriğini korur, .tmp kalmaz
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(vault): names, frontmatter and atomic writes`.

---

### Görev 4: Vault sınıfı — ağaç ve sayfa işlemleri

Spec §4 dosya kuralları.

**Files:**
- Create: `src/main/vault/vault.ts`, `src/main/vault/order.ts`, `src/main/vault/settings.ts`
- Test: `test/unit/main/vault/vault.test.ts`

**Interfaces:**
- Consumes: Görev 3 fonksiyonları, Görev 2 tipleri.
- Produces: `class Vault { constructor(root: string); init(): Promise<void>; tree(): Promise<TreeNode[]>; read(id): Promise<PageData>; write(id, {markdown, meta}): Promise<{updated}>; create(parentId|null, title?): Promise<TreeNode>; rename(id, title): Promise<TreeNode>; move(id, parentId|null, index): Promise<void>; trash(id, trashFn): Promise<void>; saveAttachment(bytes, ext, nameHint?): Promise<string>; pathOf(id): string /* mutlak */; recentWrites: Map<string, number> }`. `settings.ts`: `readSettings(root): Promise<Settings>`, `writeSettings(root, patch): Promise<Settings>`.

Davranış kararları:
- `init()` `.kernel/` ve `attachments/` oluşturur; tüm `.md` dosyalarını tarar; `id`'si olmayan dosyaya ULID (`ulid` paketi) ekleyip yazar; `id → yol` haritası tutar.
- Ağaç: `X.md` ile kardeş `X/` klasörü alt sayfaları içerir. Gizli (`.` ile başlayan) ve `attachments/` atlanır. Başlıklar NFC. Sıralama: `order.json` (`{ [parentId|"root"]: id[] }`), listede olmayanlar sonra, alfabetik (`localeCompare('tr')`).
- `rename`/`move`: `.md` ve varsa kardeş klasör birlikte taşınır; hedefte `uniqueName`.
- `create(parentId)`: üst sayfanın klasörü yoksa oluşturulur. Varsayılan başlık "Adsız".
- `write`: `meta.updated` şimdi; `recentWrites.set(path, Date.now())` (watcher kendi yazımlarını yok sayar).
- `saveAttachment`: `attachments/<nameHint ya da 'image'>-<6 hane rastgele>.<ext>`.

- [ ] **Step 1: Failing testler** (her test `mkdtemp` ile geçici kasa)

```ts
it('alt sayfa klasörüyle ağaç kurar', …)            // A.md + A/B.md → [{title:'A', children:[{title:'B'}]}]
it('id olmayan dosyaya kalıcı id ekler', …)          // init sonrası dosyada id: var; ikinci init aynı id
it('NFD dosya adını NFC başlık olarak verir', …)     // 'Özdeğerler.md' → title === 'Özdeğerler'
it('rename alt sayfa klasörünü de taşır', …)         // A → C: C.md ve C/B.md var, A/ yok, id'ler aynı
it('move büyük/küçük harf çakışmasında (2) ekler', …)
it('order.json sırasını uygular, yenileri sona ekler', …)
it('write frontmatter + gövdeyi korur ve updated günceller', …)
it('trash dosyayı ve alt klasörü trashFn ile siler', …)
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(vault): page tree and page operations`.

---

### Görev 5: IPC, preload, dosya protokolü, izleyici, kasa seçimi

**Files:**
- Create: `src/main/ipc-handlers.ts`, `src/main/protocol.ts`, `src/main/vault/watcher.ts`, `src/main/config.ts`; Modify: `src/preload/index.ts`, `src/main/index.ts`
- Test: `test/unit/main/protocol.test.ts`, `test/unit/main/watcher.test.ts`, `test/e2e/vault.spec.ts`

**Interfaces:**
- Consumes: `Vault`, `KernelApi`.
- Produces: `window.kernel: KernelApi` (search/pdf bu görevde stub; Görev 15/17'de dolar). `resolveVaultUrl(root: string, url: string): string | null` — `kernel-file://vault/<encodeURI yol>` → mutlak yol; kasa dışına çıkan (`..`, mutlak, sembolik link) her şey `null`. Renderer görselleri `kernel-file://vault/attachments/…` ile yükler. `watchVault(vault, emit): () => void`.

Kararlar: Kasa yolu sırası: `KERNEL_VAULT` env → `userData/config.json` → yoksa **ya da kayıtlı klasör artık mevcut değilse** (ör. harici disk takılı değil) arayüz `VaultPicker` gösterir (varsayılan önerisi `~/Documents/Kernel`, "Oluştur" ve "Mevcut klasörü seç"). Watcher: chokidar `ignoreInitial`, `awaitWriteFinish: { stabilityThreshold: 200 }`; `recentWrites` içinde 1 sn'den yeni olan yollar yok sayılır; yapı değişince `tree-changed`, içerik değişince `page-changed-externally(id)`.

- [ ] **Step 1: Failing testler**

```ts
expect(resolveVaultUrl(root, 'kernel-file://vault/attachments/Ekran%20G%C3%B6r%C3%BCnt%C3%BCs%C3%BC%20%C5%9F.png')).toBe(join(root, 'attachments/Ekran Görüntüsü ş.png'))
expect(resolveVaultUrl(root, 'kernel-file://vault/../etc/passwd')).toBeNull()
expect(resolveVaultUrl(root, 'kernel-file://vault/%2Fetc%2Fpasswd')).toBeNull()
// watcher: dışarıdan dosya yazımı → page-changed-externally(id); vault.write → olay yok
// e2e: KERNEL_VAULT ile açılır, window.kernel.pages.create(null,'Fizik') → tree() içinde 'Fizik'
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula (protokol `protocol.handle('kernel-file', …)` + `net.fetch(pathToFileURL(…))`, `registerSchemesAsPrivileged` ile `standard, secure, supportFetchAPI`) → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat: ipc api, vault file protocol and watcher`.

---

### Görev 6: Markdown çekirdeği — parse / serialize

Spec §4 blok eşleme tablosu. En kritik saf modül.

**Files:**
- Create: `src/core/markdown/{parse,serialize,html-blocks}.ts`
- Test: `test/unit/core/markdown/{blocks,inline,roundtrip}.test.ts`

**Interfaces:**
- Produces: `markdownToDoc(md: string): JSONContent` ve `docToMarkdown(doc: JSONContent): string` (`JSONContent` = `@tiptap/core` tipi). Düğüm/işaret adları (Görev 10–11'deki TipTap uzantıları **aynı adları** kullanır):
  - Düğümler: `doc, paragraph, heading{level 1–6}, bulletList, orderedList{start}, listItem, taskList, taskItem{checked}, blockquote, callout{type: 'note'|'tip'|'warning'|'danger'|'info'|'example', icon: string|null, title: string}, details{card: boolean}, detailsSummary, detailsContent, codeBlock{language: string|null, lineNumbers: boolean}, blockMath{latex}, inlineMath{latex}, image{src, alt, width: number|null, caption: string}, table, tableRow, tableHeader, tableCell{align: 'left'|'center'|'right'|null}, horizontalRule, hardBreak, text`
  - İşaretler: `bold, italic, underline, strike, code, link{href}, highlight{color: string|null}`

Kararlar:
- Ayrıştırma: `unified().use(remarkParse).use(remarkGfm).use(remarkMath)` → mdast → JSONContent dönüştürücüsü.
- Callout: ilk paragrafı `[!tür]` ya da `[!tür|ikon]` ile başlayan blockquote; aynı satırın kalanı `title`.
- `<details>`/`<details data-card>` … `</details>` html düğümleri arasındaki kardeşler gruplanır (iç içe için yığın); `<summary>…</summary>` içeriği satır içi olarak ayrıştırılır.
- Satır içi html: `<u>`…`</u>` → underline; `<mark>` / `<mark data-color="x">` … `</mark>` → highlight; `==x==` → highlight (renksiz). `==` eşleşmesi, metin düğümünün **kaynak dilimine** bakılarak ters eğik çizgiyle kaçırılmışsa atlanır.
- Görsel `![alt|600](src)` → `width: 600`; görselden hemen sonra gelen `*alt yazı*` tek satırlık paragraf → `caption`.
- Serileştirme: JSONContent → mdast → `remark-stringify` (`bullet: '-'`, `fences: true`, `rule: '-'`, `emphasis: '*'`, `strong: '*'`) + remark-gfm + remark-math. Callout/details/mark/u ham `html` düğümleriyle üretilir. Highlight her zaman `<mark>` (renkliyse `data-color`) olarak yazılır. Düz metindeki `$` ve `==` kaçırılır (`unsafe` kurallarına `{ character: '$' }` ve `{ character: '=', after: '=' }` eklenir).
- Blok formül her zaman `$$\n…\n$$`.

- [ ] **Step 1: Failing testler** — her blok türü için `markdownToDoc` beklenen JSON'u verir; ayrıca:

```ts
const cases = [
  '# H1\n\n###### H6', '- a\n  - b\n\n1. x\n2. y', '- [ ] yap\n- [x] bitti',
  '> [!warning|⚠️] Dikkat\n> içerik', '<details>\n<summary>Başlık</summary>\n\niçerik **kalın**\n\n</details>',
  '```python\nprint(1)\n```', '$$\n\\frac{a}{b}\n$$', 'metin $x^2$ metin', '![ş|600](attachments/a b.png)\n*alt yazı*',
  '| a | b |\n| :-- | --: |\n| 1 | 2 |', 'a <u>alt</u> <mark data-color="yellow">sarı</mark> ~~çizik~~ [link](https://x.y)',
]
for (const md of cases) it(`round-trip: ${md.slice(0, 20)}`, () => {
  const once = docToMarkdown(markdownToDoc(md))
  expect(docToMarkdown(markdownToDoc(once))).toBe(once)         // kararlı
  expect(markdownToDoc(once)).toEqual(markdownToDoc(md))        // anlam korunur
})
it('düz metindeki $ formüle dönüşmez', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '5$ ile 10$ arası' }] }] }
  expect(markdownToDoc(docToMarkdown(doc))).toEqual(doc)
})
it('düz metindeki a == b vurguya dönüşmez', …)  // aynı kalıp
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(core): markdown parse/serialize with lossless round-trip`.

---

### Görev 7: Akıllı yapıştırma I — koruma, kaçışlar, formül çıkarma

Spec §7 düz metin yolu adım 1–3.

**Files:**
- Create: `src/core/smart-paste/{protect,escapes,math}.ts`
- Test: `test/unit/core/smart-paste/{protect,escapes,math}.test.ts`

**Interfaces:**
- Produces:
  - `protectCode(text): { text: string; restore(s: string): string }` — çitli bloklar (` ``` `, `~~~`) ve satır içi kod yer tutucuya (`\u0000K<n>\u0000`).
  - `normalizeEscapes(text): string` — `\\(`, `\\)`, `\\[`, `\\]` → tek ters eğik çizgili hali; başka hiçbir şeye dokunmaz.
  - `extractMath(text): string` — tüm formülleri kanonik Kernel Markdown'ına çevirir: blok → kendi satırlarında `$$\n…\n$$` (listede ise maddenin girintisi korunarak), satır içi → `$…$`. Formül olmayan `$` karakterleri `\$` olarak kaçırılır.

- [ ] **Step 1: Failing testler**

```ts
expect(normalizeEscapes('a \\\\(x\\\\) b')).toBe('a \\(x\\) b')
expect(normalizeEscapes('\\\\vec')).toBe('\\\\vec')  // sadece ayraçlar
expect(extractMath('Formül: \\(\\vec{v} \\approx 1\\). Son.')).toBe('Formül: $\\vec{v} \\approx 1$. Son.')
expect(extractMath('- madde:\n  \\[h_t = f(x)\\]\n- diğer')).toBe('- madde:\n\n  $$\n  h_t = f(x)\n  $$\n\n- diğer')
expect(extractMath('5$ ile 10$ arası, $x^2$ ise formül')).toBe('5\\$ ile 10\\$ arası, $x^2$ ise formül')
expect(extractMath('\\begin{align}a&=b\\\\c&=d\\end{align}')).toBe('$$\n\\begin{align}a&=b\\\\c&=d\\end{align}\n$$')
expect(extractMath('\\(\\text{hidden\\_size} \\times 2\\)')).toBe('$\\text{hidden\\_size} \\times 2$')
const p = protectCode('kod `[0, 1]` ve $x$'); expect(p.text).not.toContain('[0, 1]'); expect(p.restore(p.text)).toBe('kod `[0, 1]` ve $x$')
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula (spec §7 para birimi kuralı: açılıştan sonra boşluk yok, kapanıştan önce boşluk yok, kapanıştan sonra rakam yok, aynı satır) → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(paste): code protection, escape normalization and math extraction`.

---

### Görev 8: Akıllı yapıştırma II — sezgiler, dil, HTML ve `convertPaste`

Spec §7 adım 4–8, kod dili tespiti, HTML yolu.

**Files:**
- Create: `src/core/smart-paste/{latex-line,citations,code-detect,language,html,index}.ts`, `test/fixtures/paste/*` (sentetik)
- Test: `test/unit/core/smart-paste/{latex-line,citations,code-detect,language,html}.test.ts`, `test/unit/core/smart-paste/fixtures.test.ts`

**Interfaces:**
- Consumes: Görev 6 `markdownToDoc`, Görev 7 fonksiyonları.
- Produces:

```ts
export interface PasteOptions { stripCitations: boolean; latexLineHeuristic: boolean; unfencedCodeHeuristic: boolean }
export interface PasteResult { markdown: string; doc: JSONContent; warnings: { kind: 'invalid-latex' | 'image-failed'; text: string }[]; suggestions: { kind: 'latex-line'; line: string }[] }
export function convertPaste(input: { text: string; html?: string }, options: PasteOptions): PasteResult
export function latexLineScore(line: string): number           // 0..1
export function stripCitations(text: string): string
export function detectUnfencedCode(text: string): string        // kod satır gruplarını ```dil çitine alır
export function normalizeLanguage(tag: string | null): string | null
export function detectLanguage(code: string): string | null    // highlight.js highlightAuto, spec §7 dil alt kümesi; relevance < 6 → null
export function htmlToMarkdown(html: string): string | null    // yapılandırılmış içerik yoksa null
```

Kararlar: `latexLineScore ≥ 0.75` → blok formül; `0.4–0.75` → metin + `suggestions`; `< 0.4` → dokunma. Puan: LaTeX komut/`^{`/`_{` belirteçlerinin satırdaki boşluksuz karakterlere oranı, iki harften uzun düzyazı kelime sayısı arttıkça düşer. `stripCitations`: `(?<=[\p{L}\p{P}])\[\d+(?:\s*[,–-]\s*\d+)*\]`. Pipeline sırası: `protectCode` → `normalizeEscapes` → `extractMath` → latex-line → citations → `detectUnfencedCode` → `restore` → çit etiketlerini `normalizeLanguage`, etiketsiz çitlere `detectLanguage` → KaTeX doğrulaması (`katex.renderToString(latex, { throwOnError: true })`, hata → formül metne döner + `invalid-latex` uyarısı) → `markdownToDoc`. `htmlToMarkdown`: `rehype-parse` + `rehype-remark`; `<annotation encoding="application/x-tex">` ve `<script type="math/tex">` içerikleri `$`/`$$` olarak; `<pre><code class="language-x">` dili korunur.

- [ ] **Step 1: Sentetik fixture'ları yaz** (`test/fixtures/paste/`): `notebooklm-double-escape`, `list-block-math`, `currency-and-math`, `align-env`, `bare-latex-line`, `text-tree`, `code-fenced-tagged`, `code-fenced-untagged`, `code-unfenced`, `md-fence`, `gfm-table-aligned`, `task-list`, `deep-headings`, `citations`, `inline-code-brackets`, `chatgpt-katex.html`, `claude-code.html`, `invalid-latex`. Her biri: `*.input.txt` (veya `.input.html`) + `*.expected.md`.
- [ ] **Step 2: Failing testler**

```ts
expect(normalizeLanguage('py')).toBe('python'); expect(normalizeLanguage('c++')).toBe('cpp'); expect(normalizeLanguage('text')).toBe(null); expect(normalizeLanguage('md')).toBe('markdown')
expect(detectLanguage('#include <stdio.h>\nint main(void) { return 0; }')).toBe('c')
expect(detectLanguage('SELECT name FROM users WHERE id = 1;')).toBe('sql')
expect(stripCitations('Model iyidir.[1] Ayrıca[2, 3] ve `[CLS]` ile [0, 1]')).toBe('Model iyidir. Ayrıca ve `[CLS]` ile [0, 1]')
expect(latexLineScore('\\frac{\\partial L}{\\partial w} = \\sum_{i=1}^{n} x_i')).toBeGreaterThanOrEqual(0.75)
expect(latexLineScore('Bu cümle sadece düz bir açıklamadır.')).toBeLessThan(0.4)
// fixtures.test.ts: her fixture için convertPaste(...).markdown === expected.md
// test/fixtures/private/*.md varsa: convertPaste çalışır, uyarı yok, çıktıda \\( ve \\[ kalmaz; yoksa test atlanır
it('büyük girdi hızlıdır', () => { const big = fixture('notebooklm-double-escape').repeat(40); const t = performance.now(); convertPaste({ text: big }, all); expect(performance.now() - t).toBeLessThan(300) })
```
- [ ] **Step 3:** FAIL → **Step 4:** uygula → **Step 5:** PASS (özel fixture dahil: `notebooklm-nlp-week.md`).
- [ ] **Step 6:** Commit: `feat(paste): heuristics, language detection, html path and convertPaste`.

---

### Görev 9: Uygulama kabuğu — Ada teması, kenar çubuğu, sayfa ağacı

Spec §5.

**Files:**
- Create: `src/renderer/styles/{tokens,glass,app}.css`, `src/renderer/state/store.ts`, `src/renderer/shell/{Sidebar,PageTree,VaultPicker,Toasts}.tsx`, `src/renderer/router.ts`; Modify: `App.tsx`
- Test: `test/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: `window.kernel`.
- Produces: Zustand `useStore` → `{ tree, currentId, settings, openPage(id), refreshTree(), setSettings(patch), toast(msg, kind?) }`. CSS değişkenleri: `--bg, --page, --page-radius: 14px, --page-inset: 10px, --accent, --text, --text-2, --text-3, --border, --glass-bg, --glass-border, --font-ui, --font-body, --font-mono`. `data-theme="light|dark"` `<html>`'de; `system` → `prefers-color-scheme`.

Kenar çubuğu: üstte trafik ışıkları için 52 px boşluk ve sürükleme bölgesi (`-webkit-app-region: drag`), arama girişi (Cmd+K'yı açar), "Dersler" yerine kasa adı, ağaç (dnd-kit ile sürükle-bırak → `pages.move`; satır üzerinde `+` → alt sayfa; sağ tık menüsü: Yeni alt sayfa, Yeniden adlandır, İkon değiştir, Finder'da göster, PDF olarak dışa aktar, Çöp kutusuna taşı), altta Rehber ve Ayarlar. Cmd+\ daraltır. Cmd+N yeni sayfa, Cmd+Shift+N alt sayfa.

- [ ] **Step 1: Failing e2e testleri**: boş kasada `VaultPicker` görünmez (env ile kasa verildi), "Yeni sayfa" → ağaçta "Adsız"; yeniden adlandır "Fizik" → diskte `Fizik.md`; "Fizik"e alt sayfa → `Fizik/Adsız.md`; sürükle-bırak ile kökten alta taşıma; Cmd+\ kenar çubuğunu gizler.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Açık ve koyu temada ekran görüntüsü alıp spec §5 ile karşılaştır.
- [ ] **Step 5:** Commit: `feat(ui): ada shell, sidebar and page tree`.

---

### Görev 10: Editör temeli — yükleme, otomatik kayıt, güvenli kapanış

Spec §6, §14.

**Files:**
- Create: `src/renderer/editor/{Editor.tsx,extensions.ts,autosave.ts}`, `src/renderer/shell/ConflictDialog.tsx`, `src/renderer/styles/editor.css`; Modify: `src/main/window.ts`
- Test: `test/unit/renderer/autosave.test.ts`, `test/e2e/editor.spec.ts`

**Interfaces:**
- Consumes: `markdownToDoc`/`docToMarkdown`, `pages.read/write`, `events.onPageChangedExternally`, `app.onFlushRequest`.
- Produces: `buildExtensions(opts): Extension[]` (Görev 11–13 buraya ekler); `createAutosave(save: () => Promise<void>, delayMs = 500): { schedule(): void; flush(): Promise<void>; state: 'saved' | 'dirty' | 'saving' | 'error' }` (hata → 5 sn'de bir tekrar).

Kararlar: Başlık alanı ayrı bir `<textarea>`; Enter gövdeye geçer; başlık değişince 500 ms sonra `pages.rename`. Temel uzantılar: StarterKit (heading 1–6), TaskList/TaskItem, Underline, Link, Table ailesi, Placeholder ("Yazmaya başla ya da / yaz"), Markdown giriş kuralları (StarterKit'inkiler + `$$` → blockMath, `[] ` → taskItem). Kapanış: ana süreç `close` olayında `preventDefault` → renderer'a `flush` isteği → yanıt (en fazla 3 sn) → pencereyi kapat. Dış değişiklik: sayfa temizse sessizce yeniden yüklenir; kirliyse `ConflictDialog` ("Benimkini koru" / "Diskteki sürümü yükle"). Kayıt durumu başlık satırının sağında küçük bir göstergeyle (Kaydedildi / Kaydediliyor / Kaydedilemedi) gösterilir. `markdownToDoc` hata fırlatırsa sayfa salt okunur ham metin olarak açılır, dosyaya asla yazılmaz, uyarı bandı gösterilir.

- [ ] **Step 1: Failing testler**

```ts
// autosave (fake timers): schedule ×3 hızlıca → 500 ms sonra tek save; save reject → state 'error', 5 sn sonra tekrar
// e2e: sayfaya "Merhaba **dünya**" yaz → 1 sn bekle → dosya gövdesi "Merhaba **dünya**\n"
// e2e: yaz ve 50 ms içinde app.close() → dosyada son karakter var   (Review Focus 2)
// e2e: dosyayı dışarıdan değiştir → temiz editör yeni içeriği gösterir
// e2e: ayrıştırılamayan dosya → salt okunur bant görünür, dosyanın mtime'ı değişmez
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(editor): load/save pipeline with autosave and safe quit`.

---

### Görev 11: Zengin bloklar — kod, formül, callout, toggle, görsel, tablo

Spec §6.

**Files:**
- Create: `src/renderer/editor/nodes/{CodeBlock,MathBlock,MathInline,Callout,Details,Image,MarkColor}.ts`, `src/renderer/editor/ui/{CodeBlockView,MathView,ImageView}.tsx`, `src/renderer/lib/{shiki,katex}.ts`
- Test: `test/e2e/blocks.spec.ts`

**Interfaces:**
- Consumes: Görev 6 düğüm/işaret adları (aynen), `attachments.save`.
- Produces: `buildExtensions`'a eklenen uzantılar; `getHighlighter(): Promise<Highlighter>` (temalar `github-light-default` / `github-dark-default`, spec §7 dil listesi).

Kararlar:
- **CodeBlock:** `prosemirror-highlight` + Shiki; NodeView: sağ üstte aranabilir dil seçici (Görev 8 listesi + "Düz metin"), Kopyala butonu, satır numarası aç/kapat (blok başına, `codeBlock{lineNumbers: boolean}`; Markdown'da çit bilgisine `python {lineNumbers}` olarak yazılır — Görev 6'da da desteklenir); Tab → 2 boşluk girinti.
- **Formül:** `@tiptap/extension-mathematics` (`BlockMath`, `InlineMath`, düğüm adları `blockMath`/`inlineMath`). Tıklayınca cam düzenleme alanı + canlı önizleme; hatalı LaTeX → kırmızı alt çizgi + KaTeX hata metni, son geçerli render korunur. `$…$` yazınca satır içi formüle dönüşür. Cmd+Shift+M seçimi satır içi formül yapar.
- **Callout:** 6 tür, her birinin rengi ve varsayılan ikonu (note 📝, tip 💡, warning ⚠️, danger 🚫, info ℹ️, example 🧪); ikona tıklayınca değiştirme.
- **Details:** `@tiptap/extension-details`; `card` özniteliği (Faz 3'te kullanılacak, şimdiden serileşir).
- **Image:** yapıştır / sürükle / dosya seç → `attachments.save` → `src` = `attachments/…`, görüntülerken `kernel-file://vault/` + `encodeURI`. Köşeden sürükleyerek genişlik, altında alt yazı alanı.
- **Table:** başlık satırı, satır/sütun ekle-sil menüsü, sütun hizalama.
- **Highlight:** 6 renk (yellow, green, blue, pink, purple, gray) + renksiz.

- [ ] **Step 1: Failing e2e testleri**: her blok `/` olmadan Markdown kısayoluyla oluşturulur (` ```py ` → Python kod bloğu; `$$` → blok formül; `> [!tip]` yapıştırma değil, menüden callout); oluşturulan sayfa kaydedilip yeniden açıldığında aynı bloklar görünür; `![x](attachments/a b ş.png)` içeren dosyadaki görsel yüklenir (`naturalWidth > 0`) (Review Focus 5); hatalı LaTeX `\frac{a` editörü bozmaz.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(editor): code, math, callout, toggle, image and table blocks`.

---

### Görev 12: Editör etkileşimi — `/` menüsü, biçim araç çubuğu, blok tutamağı

**Files:**
- Create: `src/renderer/editor/ui/{SlashMenu,BubbleToolbar,BlockHandle}.tsx`
- Test: `test/e2e/editor-ui.spec.ts`

**Interfaces:**
- Consumes: Görev 10–11 uzantıları.
- Produces: `SLASH_ITEMS: { id: string; label: string; keywords: string[]; icon: string; run(editor): void }[]` (Rehber Görev 19'da da kullanır).

Kararlar: `/` menüsü `@tiptap/suggestion` ile, cam yüzey, `normalizeTr` ile arama ("baslik" → "Başlık 2"), ok tuşları + Enter. Öğeler: Metin, Başlık 1–6, Madde listesi, Numaralı liste, Yapılacaklar, Toggle, Callout, Alıntı, Kod, Formül, Satır içi formül, Görsel, Tablo, Ayırıcı. Bubble araç çubuğu: kalın, italik, altı çizili, üstü çizili, kod, formül, link, vurgu rengi. Blok tutamağı `@tiptap/extension-drag-handle-react`: sürükle-bırak; tıklayınca menü (Dönüştür, Çoğalt, Sil, Renk). Kısayollar: Cmd+B/I/U, Cmd+Shift+S, Cmd+Alt+C (kod bloğu).

- [ ] **Step 1: Failing e2e testleri**: `/basl` + Enter → başlık; metin seç → araç çubuğu görünür, "Kalın" → `**`; blok sürükle → sıra değişir ve dosyaya yansır.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(editor): slash menu, bubble toolbar and block handle`.

---

### Görev 13: Yapıştırma entegrasyonu

Spec §7 "Kullanıcı kontrolü".

**Files:**
- Create: `src/renderer/editor/paste.ts`, `src/renderer/editor/nodes/PasteSuggestion.ts`
- Test: `test/e2e/paste.spec.ts`

**Interfaces:**
- Consumes: `convertPaste`, `settings.paste`, `attachments.save`, `attachments.fetchRemote`.
- Produces: `SmartPaste` uzantısı (`handlePaste` ProseMirror prop'u).

Kararlar: Kod bloğu içinde yapıştırma her zaman ham metin. Panoda yalnızca görsel varsa → görsel bloğu. Aksi halde `convertPaste` → belgeye ekle; işlem `smartPaste` meta'sıyla tek geri alma adımı. Hemen ardından Cmd+Z → dönüştürülmüş içerik yerine ham metin (ikinci Cmd+Z tamamen geri alır). Cmd+Shift+V → ham metin. HTML'deki uzak görseller `fetchRemote` ile indirilir (başarısız → link + toast). `suggestions` → ilgili paragrafa `suggestMath` dekorasyonu (küçük "Formüle çevir" çipi; tıklayınca blok formül). `warnings` → toast ("1 formül doğrulanamadı, metin olarak bırakıldı").

- [ ] **Step 1: Failing e2e testleri**: `notebooklm-double-escape` fixture'ı panoya → kaydedilen Markdown fixture `expected.md` ile aynı; yapıştır + Cmd+Z → ham metin görünür; Cmd+Shift+V → `\\(` metni olduğu gibi kalır; kod bloğu içine yapıştırma dönüştürülmez.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS. Kullanıcının gerçek örneğini (`test/fixtures/private/notebooklm-nlp-week.md`) uygulamaya elle yapıştırıp görsel olarak kontrol et.
- [ ] **Step 5:** Commit: `feat(editor): smart paste integration with undo-to-raw`.

---

### Görev 14: Sayfa başlığı — ikon ve kapak

Spec §5 "Sayfa başlığı alanı".

**Files:**
- Create: `src/renderer/shell/{PageHeader,IconPicker,CoverPicker}.tsx`, `src/renderer/assets/covers.ts`
- Test: `test/e2e/header.spec.ts`

**Interfaces:**
- Consumes: `PageMeta.icon/cover/coverPosition`, `attachments.save`.
- Produces: `COVER_PRESETS: { id: string /* "kernel:teal-waves" */; label: string; css: string }[]` (PDF Görev 17'de aynı CSS'i kullanır) — en az 8 hazır kapak (Ada paletinden düz renkler ve basit radial desenler).

Kararlar: Başlığın üstüne gelince "İkon ekle" / "Kapak ekle" (cam küçük butonlar). İkon seçici: `emojibase-data` (tr etiketleriyle arama, `normalizeTr`) + "Görsel yükle" + "Kaldır". Kapak: 200 px yükseklik; "Değiştir" (hazırlar / görsel yükle), "Konumlandır" (dikey sürükleme → `coverPosition` 0–1), "Kaldır". İkon kenar çubuğu ağacında da görünür.

- [ ] **Step 1: Failing e2e testleri**: emoji seç → frontmatter `icon: "🧮"` ve ağaçta ikon; hazır kapak → `cover: kernel:teal-waves`; görsel kapak → `attachments/…` ve görünür; konumlandırma → `coverPosition` güncellenir.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(ui): page icon and cover`.

---

### Görev 15: Arama ve Cmd+K

Spec §9.

**Files:**
- Create: `src/main/search.ts`, `src/renderer/shell/SearchPalette.tsx`; Modify: `src/main/ipc-handlers.ts`
- Test: `test/unit/main/search.test.ts`, `test/e2e/search.spec.ts`

**Interfaces:**
- Consumes: `Vault`, `normalizeTr`, watcher olayları.
- Produces: `class SearchIndex { build(vault): Promise<void>; update(id): Promise<void>; remove(id): void; query(q, limit = 20): SearchHit[] }`; `search.recent()` son açılan 8 sayfa (bellekte + `.kernel/settings.json`'da değil, `.kernel/recent.json`'da).

Kararlar: MiniSearch alanları `title` (boost 3) ve `text` (Markdown'dan işaretler temizlenmiş, formül LaTeX'i dahil); `processTerm: normalizeTr`; `fuzzy: 0.2`, `prefix: true`. `snippet`: ilk eşleşmenin etrafında 80 karakter. İndeks bellekte; başlangıçta arka planda kurulur; `.kernel/search-index.json` önbelleği (silinirse yeniden kurulur).

- [ ] **Step 1: Failing testler**

```ts
// "Özdeğerler" başlıklı ve gövdesinde "karakteristik polinom" geçen sayfa
expect(idx.query('ozdeger')[0].title).toBe('Özdeğerler')
expect(idx.query('KARAKTERİSTİK')[0].snippet).toContain('karakteristik polinom')
// update sonrası yeni kelime bulunur; remove sonrası bulunmaz
// e2e: Cmd+K → yaz → Enter → sayfa açılır
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat: full-text search and command-k palette`.

---

### Görev 16: İçindekiler paneli, tema ve ayarlar

Spec §5, §7 ayarlar, §13.

**Files:**
- Create: `src/renderer/shell/{TocPanel,SettingsDialog}.tsx`
- Test: `test/e2e/settings.spec.ts`

**Interfaces:**
- Consumes: editör belgesi (başlık düğümleri), `settings.get/set`.
- Produces: Ayarlar penceresi bölümleri: Görünüm (tema, not fontu, sayfa genişliği: dar 600 px / normal 720 px / geniş 900 px), Yapıştırma (3 anahtar), İpuçları (aç/kapat, sıfırla), Kasa (yol, Finder'da göster, değiştir).

Kararlar: TOC sağda, Cmd+Shift+T ile açılıp kapanır, başlık seviyesine göre girinti, tıklayınca yumuşak kaydırma, görünür bölüm `IntersectionObserver` ile vurgulanır. Ayarlar Cmd+, ile cam modal.

- [ ] **Step 1: Failing e2e testleri**: 3 başlıklı sayfada TOC 3 öğe gösterir, tıklama kaydırır; tema "Koyu" → `data-theme="dark"`; not fontu "Sans" → editör `font-family` değişir; ayarlar yeniden başlatmada korunur.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(ui): table of contents, theme and settings`.

---

### Görev 17: PDF export

Spec §8.

**Files:**
- Create: `src/main/pdf.ts`, `src/renderer/print/PrintView.tsx`, `src/renderer/styles/print.css`, `src/renderer/shell/ExportDialog.tsx`
- Test: `test/pdf/export.spec.ts`, `test/pdf/fixtures/*.md` (sentetik sayfalar), `test/pdf/baseline/*.png`

**Interfaces:**
- Consumes: `Vault`, `PdfOptions`, `COVER_PRESETS`, Görev 11 render bileşenleri.
- Produces: `exportPdf(vault, id, options, savePath?): Promise<string>` (`savePath` yoksa kaydet diyaloğu; testler `savePath` verir).

Kararlar:
- Gizli `BrowserWindow` (`show: false`, aynı preload) `#/print?ids=<id1,id2…>&opts=<json>` yükler. `PrintView` her sayfayı salt okunur TipTap (`editable: false`) ile, aynı uzantılarla çizer; alt sayfalar dahilse her sayfa `break-before: page` ile başlar.
- Hazır olma sinyali: tüm `img` `decode()` + `document.fonts.ready` + KaTeX/Shiki render tamam → `window.kernelPrintReady = true`; ana süreç bunu bekler (en fazla 20 sn, sonra hata).
- `printToPDF({ printBackground: true, generateDocumentOutline: true, pageSize, margins: { narrow: 0.4, normal: 0.75, wide: 1.0 } (inç), displayHeaderFooter: pageNumbers, footerTemplate: '<div style="font-size:9px;width:100%;text-align:center;color:#777"><span class="pageNumber"></span> / <span class="totalPages"></span></div>', headerTemplate: '<div></div>' })`.
- `print.css`: spec §8 kırılım kuralları (`h1–h6 { break-after: avoid }`, `.math-block, img, .callout, tr, .code-chunk { break-inside: avoid }`, `thead { display: table-header-group }`). `PrintView` kod bloklarını 25 satırlık `.code-chunk` parçalarına böler; ilk parça dışındakiler "dil · devam" etiketi taşır. Böylece kısa bloklar bölünmez, uzun bloklar düzgün bölünür ve etiket tekrarlanır; toggle'lar açık; kenar çubuğu yok; kapak `showCover` ise ilk sayfanın üstünde.
- Dosya adı varsayılanı: `<Sayfa başlığı>.pdf`; yarım dosya bırakılmaz (önce geçici dosya, sonra `rename`).
- Export penceresi: spec §8 seçenekleri; Cmd+E açar.

- [ ] **Step 1: Sentetik PDF fixture'ları**: `mixed.md` (başlıklar, formüller, 40 satırlık kod, tablo, görsel `attachments/örnek görsel ş.png`, callout, toggle), `long-code.md`.
- [ ] **Step 2: Failing testler**

```ts
// export → PDF var; pdfjs ile: sayfa sayısı > 0, metin katmanında "Özdeğerler" var (vektörel metin),
// outline başlıkları içerir, görsel nesnesinin piksel genişliği orijinal görselinkine eşit (sıkıştırma/küçültme yok)
// her sayfa PNG'ye çevrilir (@napi-rs/canvas, scale 2) → baseline ile pixelmatch, fark < %0.5
// tek satırlık kod bloğu iki sayfaya bölünmez (bloğun kutusu tek sayfada)
```
- [ ] **Step 3:** FAIL (baseline yoksa ilk çalıştırma baseline üretir; görsel olarak elle doğrula ve commit et) → **Step 4:** uygula → **Step 5:** PASS.
- [ ] **Step 6:** Commit: `feat: pixel-faithful pdf export`.

---

### Görev 18: Logo, ikon ve `.app` paketi

Spec §5 Logo.

**Files:**
- Create: `build/icon.svg`, `scripts/make-icon.mjs`, `electron-builder.yml`; Generate: `build/icon.icns`
- Test: elle doğrulama + `test/unit/scripts/icon.test.ts`

**Interfaces:**
- Produces: `npm run icon` (svg → `.icns`), `npm run dist` → `release/Kernel-<sürüm>-arm64.dmg` ve `release/mac-arm64/Kernel.app`.

Kararlar: Logo SVG (1024 ızgara, macOS ikon güvenli alanı ~824 px): `#0E7C6B` yuvarlatılmış kare (r ≈ 185) → beyaz, köşesi kıvrık sayfa (kıvrım `#BFE6DE`) → sayfada `#0E7C6B`, yuvarlak uçlu, stroke ≈ 56 px "K". `make-icon.mjs`: sharp ile 16, 32, 64, 128, 256, 512, 1024 px PNG (`icon.iconset/icon_16x16.png`, `icon_16x16@2x.png`…) → `iconutil -c icns`. electron-builder: `appId: app.kernel.notes`, `productName: Kernel`, `mac.target: [dmg, dir]`, `arch: arm64`, `category: public.app-category.productivity`, imzasız (`identity: null`). Uygulama içi tek renkli logo `src/renderer/assets/logo-mono.svg`.

- [ ] **Step 1: Failing test**: `make-icon` çalıştıktan sonra `build/icon.icns` var ve `iconutil -c iconset` ile açıldığında 10 dosya içeriyor.
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** `npm run dist` → `Kernel.app`'i `/Applications`'a kopyala (kullanıcıya sorarak), Dock'tan aç, ikonun Dock'ta ve Finder'da doğru göründüğünü ekran görüntüsüyle doğrula.
- [ ] **Step 6:** Commit: `feat: kernel logo, app icon and mac packaging`.

---

### Görev 19: Tanıtım turu, Rehber ve ipuçları

Spec §13.

**Files:**
- Create: `src/renderer/guide/{Tour,GuidePage}.tsx`, `src/renderer/guide/shortcuts.ts`, `src/renderer/guide/tips.ts`, `src/renderer/guide/demos/{PasteDemo,MathDemo,BlocksDemo,PdfDemo}.tsx`
- Test: `test/unit/renderer/shortcuts.test.ts`, `test/e2e/guide.spec.ts`

**Interfaces:**
- Consumes: `settings.tourDone`, `settings.tips`, `SLASH_ITEMS`, `convertPaste`, Görev 11 bileşenleri.
- Produces: `SHORTCUTS: { group: string; keys: string; action: string; phase: 1 | 2 | 3 }[]` (spec §13 tablosu; Faz 1 dışındakiler `phase` ile işaretli, rehberde gösterilmez); `showTip(id: TipId)`; `TipId = 'first-paste' | 'first-math' | 'first-slash' | 'first-export'`.

Kararlar: Tur 5 kart (kasa yeri, akıllı yapıştırma, `/` menüsü, Cmd+K, PDF), cam modal, "Atla" ve ilerleme noktaları; bitince `tourDone: true`. Rehber Cmd+/ ile, kasaya yazılmayan uygulama içi sayfa: bölümler (Akıllı yapıştırma, Formül ve kod, Bloklar, İkon ve kapak, Arama, PDF) — her biri kısa metin + canlı demo (PasteDemo: solda ham NotebookLM metni, sağda `convertPaste` çıktısının salt okunur render'ı). Kısayol tablosu `normalizeTr` ile aranabilir. İpuçları: her `TipId` bir kez, `tips.enabled` false ise hiç.

- [ ] **Step 1: Failing testler**

```ts
// shortcuts: tüm Faz 1 kısayolları benzersiz; spec §13'teki Faz 1 satırlarının hepsi var
// e2e: ilk açılışta tur görünür, "Atla" → bir daha görünmez (yeniden başlatma sonrası da)
// e2e: Cmd+/ → Rehber; arama "pdf" → Cmd+E satırı; ilk yapıştırmada 'first-paste' ipucu bir kez görünür
```
- [ ] **Step 2:** FAIL → **Step 3:** uygula → **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat: onboarding tour, guide page and tips`.

---

### Görev 20: Faz 1 kapanışı — doğrulama, README, GitHub

**Files:**
- Create: `README.md` (Türkçe + kısa İngilizce özet: ne olduğu, kurulum, `npm run dist`, notların kasada durduğu, lisans); Modify: `CLAUDE.md`

- [ ] **Step 1:** `npm test && npm run test:e2e && npx playwright test test/pdf` → hepsi PASS (çıktıyı kaydet).
- [ ] **Step 2:** Sızıntı kontrolü: `git status --porcelain` ve `git ls-files | grep -Ei '\.(md|png|jpe?g|pdf)$'` → yalnızca `docs/`, `test/fixtures/paste/`, `test/pdf/`, `build/`, `README.md`, `CLAUDE.md`, `src/renderer/assets/` altındakiler. `test/fixtures/private/` listede **olmamalı**.
- [ ] **Step 3:** `npm run dist`, uygulamayı aç, kullanıcıyla birlikte elle kabul turu: sayfa oluştur, NotebookLM örneğini yapıştır, ikon/kapak ekle, PDF al.
- [ ] **Step 4:** Commit: `docs: readme and phase 1 wrap-up`.
- [ ] **Step 5:** **Kullanıcıya sor**, onay gelirse: `gh repo create kernel --public --source . --push --description "Lokal, açık kaynak, Markdown tabanlı not uygulaması"`; tag `v0.1.0`.
