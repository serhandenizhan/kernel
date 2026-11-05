# Faz 4 — Bilgi ağı ve çalışma araçları — Uygulama planı

> Yürütme: Native (executing-plans). Adımlar `- [ ]` ile izlenir.

**Goal:** §12'deki bilgi ağı ve çalışma araçlarını eklemek: `[[` seçici, geri bağlantılar, yeniden adlandırmada link güncelleme, etiketler, komut paleti, odak modu, graf, sekmeler, flashcard + FSRS, ana sayfada "Bugünün tekrarı".

**Architecture:** Link/etiket/kart çıkarımı `src/core/` altında saf modüllerdir (Node'da test edilir). Ana süreçte `LinkIndex` kasanın Markdown'ını tarar, IPC ile geri bağlantı / graf / etiket verir; yeniden adlandırma bütün kasadaki `[[eski]]` linklerini atomik yazımla günceller. Arayüz parçaları mevcut cam (glass) bileşenleri ve sözlüğü kullanır.

**Tech Stack:** Electron 45, React 19, TipTap 3, Zustand, Vitest, Playwright; yeni: `d3-force`, `ts-fsrs`.

**Spec:** `docs/superpowers/specs/2026-11-04-kernel-design.md` §12, §4, §16.

## Global Constraints
- Kullanıcı notları asla repoya girmez; test verileri sıfırdan yazılır; her commit öncesi `npm run check:private`.
- Kod İngilizce, yorumlar Türkçe; her arayüz metni `src/shared/i18n/messages/*.ts` içinde `[tr, en, de]`; `npm run check:i18n` temiz.
- `src/core/` Electron/DOM bağımsız. TDD.
- Linkler dosyada `[[Sayfa adı]]` / `[[Yol/Ad]]` / `[[Ad|görünen]]` olarak kalır.
- Kart verisi `.kernel/srs.json`; kart kimliği = sayfa id + normalize soru özeti; eski kart verisi 30 gün tutulur.
- Push / kurulum yalnızca kullanıcı onayıyla.

## Review Focus
- Yeniden adlandırmada `[[Ad|görünen]]` etiketi ve kod bloğu içindeki `[[...]]` metni: etiket korunmalı, kod bloğu değişmemeli.
- Aynı ada sahip iki sayfa: yol ile yazılmış link yanlış sayfaya bağlanmamalı.
- Geri bağlantı bağlamı: çok uzun satırda kesilmeli, frontmatter dahil edilmemeli.
- `#etiket` yakalaması: başlık `# Başlık`, URL parçası `#bolum`, kod içi `#include` etiket sayılmamalı.
- Bozuk / elle düzenlenmiş `srs.json`: uygulama açılmalı, bozuk kayıt yok sayılmalı.

---

### Task 1: Saf link/etiket çıkarımı — `src/core/links.ts`
- `extractLinks(markdown): { target: string; label: string | null; line: string }[]` — frontmatter ve kod (``` ve satır içi `) hariç.
- `extractTags(markdown): string[]` — frontmatter `tags` + metindeki `#etiket` (harf/rakam/_/-/ /, Türkçe harfler; başlık, URL fragmanı, kod hariç), küçük harfe katlanır, tekilleştirilir.
- `renameLinks(markdown, oldTargets: string[], newTarget: string): string` — eşleşen hedefleri değiştirir, `|görünen` ve kodu korur; değişiklik yoksa aynı string.
- Testler: `test/unit/core/links.test.ts` (Review Focus satırları 1, 3, 4 dahil).

### Task 2: Ana süreç LinkIndex + IPC
- `src/main/links.ts`: `LinkIndex` — `build(vault)`, `update(id, markdown)`, `remove(id)`, `backlinks(id): {id,title,context}[]`, `graph(): {nodes:{id,title,folder,tags}[], links:{source,target}[]}`, `tags(): {tag,count}[]`, `pagesWithTag(tag): string[]`.
- Çözümleme `resolveWikiTarget` ile (ağaçtan).
- `Vault.rename` sonrası: eski başlık ve eski yol hedefli linkler kasada güncellenir (`renameLinks`), değişen dosyalar atomik yazılır, açık sayfaya `event:page-changed`.
- IPC: `links.backlinks`, `links.graph`, `tags.list`, `tags.pages`; olay `event:links-changed` (500 ms birleştirme).
- Testler: `test/unit/main/links.test.ts` (aynı ad / yol çakışması, yeniden adlandırma).

### Task 3: `[[` sayfa seçici
- TipTap Suggestion (`char: '[['`) → cam seçici (mevcut slash menüsü desenini izler), başlığa göre bulanık filtre (`foldKey`), seçince `wikiLink` düğümü; eşleşme yoksa "“X” sayfasını oluştur" maddesi → link eklenir (sayfa tıklanınca oluşturulur).
- Var olmayan sayfa linkine tıklama → sayfa oluşturulur ve açılır (spec §12).
- e2e: `test/e2e/wiki-picker.spec.ts`.

### Task 4: Geri bağlantılar paneli
- `src/renderer/shell/Backlinks.tsx`, sayfanın altında; "Bu sayfaya bağlananlar" + bağlam cümlesi; tıklayınca açar; boşsa gizli.
- e2e: `test/e2e/backlinks.spec.ts` (yeniden adlandırma linki günceller).

### Task 5: Komut paleti (Cmd+P) ve odak modu (Cmd+Shift+F)
- `src/renderer/shell/CommandPalette.tsx`: komut kaydı (`src/renderer/commands.ts`: id, başlık anahtarı, kısayol, run). Yeni sayfa, ders notu, PDF/Markdown/HTML export, tema, odak modu, graf, çalışma ekranı, ayarlar, rehber.
- Odak modu: store `focusMode`; kenar çubuğu, içindekiler, araç çubukları gizlenir. Menüye eklenir.
- e2e: `test/e2e/command-palette.spec.ts`.

### Task 6: Etiketler
- `#etiket` editörde dekorasyonla vurgulanır (dosya formatı düz metin kalır).
- Kenar çubuğunda katlanır "Etiketler" bölümü; etikete tıklayınca o etiketi taşıyan sayfalar listesi (görünüm `tag`).
- e2e: `test/e2e/tags.spec.ts`.

### Task 7: Graf görünümü
- `d3-force` + canvas; genel graf (görünüm `graph`) ve sayfa başlığından açılan yerel graf (komşular); klasöre göre renk; tıklayınca sayfa.
- Birim: düğüm/kenar hazırlama saf fonksiyonu `src/core/graph.ts` (`localGraph(graph, id, depth=1)`).
- e2e: `test/e2e/graph.spec.ts`.

### Task 8: Sekmeler ve bölünmüş ekran
- Store: `tabs: {id,pageId}[]`, `active`, `split: [paneA, paneB] | null`; Cmd+tık yeni sekme; Cmd+W sekme kapatır; sekmeyi sağa sürükleyince 2 bölme. `.kernel/` değil, userData `tabs.json`'da hatırlanır.
- e2e: `test/e2e/tabs.spec.ts`.

### Task 9: Flashcard'lar + FSRS
- `src/core/cards.ts`: `extractCards(pageId, markdown)` → `Soru :: Cevap` satırları ve `<details data-card>`; `cardId(pageId, question)`.
- `src/main/srs.ts`: `SrsStore` (`.kernel/srs.json`, `ts-fsrs`), `due(deck)`, `review(cardId, rating)`, 30 gün sonra yetim kart temizliği, bozuk kayıt toleransı.
- Çalışma ekranı (görünüm `study`): deste seçimi (sayfa / klasör+alt sayfalar / etiket), vadesi gelen sayısı, Tekrar/Zor/İyi/Kolay, sınav modu (karışık, tümü). Toggle bağlam menüsüne "Kart olarak işaretle".
- Ana sayfa: "Bugünün tekrarı" kartı (vadesi gelen sayı + Başla).
- Testler: `test/unit/core/cards.test.ts`, `test/unit/main/srs.test.ts`, `test/e2e/study.spec.ts`.

### Task 10: Rehber, belgeler, sürüm
- Rehber bölümleri (üç dil), CLAUDE.md Faz 4 notları, README, sürüm 0.4.0; tüm testler + `check:private` + `check:i18n`.
- Son: tüm dal incelemesi (taze inceleyici).
