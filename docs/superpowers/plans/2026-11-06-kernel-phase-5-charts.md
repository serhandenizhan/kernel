# Faz 5 — Grafikler, diyagramlar, içindekiler, kart ekleme — Uygulama planı

> Yürütme: Native. Kullanıcı isteği (2026-11-06): "/" ile kolay grafik (7-8 tür), diyagram, x,y(,z) düzlemi; sağda üzerine gelince açılan içindekiler; "/" ile soru-cevap kartı; artifact grafikleri yapıştırınca gelsin.

**Goal:** Not içinde kolay doldurulan, güzel görünen grafik ve diyagramlar; gezinme ve kart yazımını kolaylaştırmak.

**Architecture:** Grafik verisi Markdown'da ` ```chart ` kod bloğunda JSON olarak durur (başka editörde okunur, Kernel'de çizilir; Mermaid bloğuyla aynı desen). Çizim saf modülde: `src/core/charts/` spec doğrulama + SVG üretimi (Node'da test edilir). Editörde `CodeBlockView` `chart` dilini grafik + düzenleme paneliyle gösterir.

## Kararlar (benim; kullanıcı aksini söylerse değişir)
- Türler (8 grafik + 2 özel): Sütun, Yatay çubuk, Çizgi, Alan, Pasta, Halka, Dağılım, Radar; Akış diyagramı; Koordinat düzlemi (x,y; z eklenip çıkarılır, 3B görünüm sürükleyerek döner).
- Veri modeli: `{ v:1, type, title?, series:[{name,color}], rows:[{label,color?,values:number[]}], points?, nodes?, edges?, axes? }`.
- Satır düzenleme: ad + sayı (yüzde / oran / sayı fark etmez, pasta oranı kendisi hesaplar) + renk; satırlar tutamakla sürükle-bırak; grafikte sütun / dilim sürüklenerek de yer değiştirir (sütun, yatay çubuk, pasta, halka).
- Akış diyagramı: düğüm (ad, şekil, renk) + bağlantı (nereden → nereye, etiket); kendi katmanlı yerleşimimiz (Mermaid'e bağlı değil, tema uyumlu).
- Düzlem: noktalar (x,y[,z], ad, renk), "noktaları birleştir" seçeneği; z kapalıyken 2B, açıkken eğik izdüşümlü 3B.
- Renk paleti tema token'larından (`--graph-0..5` + ek), açık/koyu temada okunur.
- İçindekiler: sayfada 2+ başlık varsa sağ kenarda başlık başına ince çizgi (seviyeye göre kısa/uzun, okunan bölüm vurgulu); üzerine gelince cam panel açılır. Cmd+Shift+T sabit paneli aynen kalır.
- "/" kart: "Soru-cevap kartı" → `Soru :: Cevap` satırı, imleç soruda; "Katlanır kart" → kart işaretli toggle.
- Yapıştırma: kod bloğu içine ```` ```dil ```` çitli metin yapıştırılınca çitler atılır (dil boşsa çitteki dil atanır). Artifact HTML'indeki `<svg>` grafikler `attachments/` içine `.svg` görsel olarak kaydedilip yerine görsel konur (CSS değişkenleri / currentColor sabit renge çevrilir).

## Global Constraints
- Kullanıcı notları asla repoya girmez; test verileri sıfırdan; her commit öncesi `npm run check:private`.
- Kod İngilizce, yorumlar Türkçe, arayüz metinleri sözlükte `[tr,en,de]`; `npm run check:i18n` temiz.
- `src/core/` Electron/DOM bağımsız; TDD.
- Push / sürüm yalnızca kullanıcı onayıyla. 5 saatlik kullanım %80'de durulur.

## Review Focus
- Bozuk / elle düzenlenmiş ` ```chart ` JSON'u: editör çökmez, blok kod olarak görünür ve uyarı verir.
- Çok uzun etiket, negatif değer, sıfır toplamlı pasta, tek satır, 0 satır.
- Koyu temada kontrast; PDF dışa aktarımda grafik vektörel çizilir.
- Grafikte sürükle-bırak sonrası Markdown'daki satır sırası değişir; geri al (⌘Z) çalışır.
- Artifact SVG'sinde script / dış kaynak: kaydedilen SVG temizlenir (script, on* özellikleri, dış href atılır).

## Görevler
1. Kod bloğuna çitli yapıştırma (paste.ts) — e2e.
2. "/" kart öğeleri (slash-items) — e2e.
3. İçindekiler şeridi (TocPanel rail) — e2e.
4. `src/core/charts/spec.ts` (parse/normalize/serialize, varsayılan örnekler) + `render.ts` (8 tür SVG) — birim.
5. `ChartBlockView` + `ChartEditor` (satır ekle/sil, renk, tür değiştir, satır ve grafik sürükle-bırak) + "/" grafik öğeleri — e2e.
6. Akış diyagramı yerleşimi + düzlem (2B/3B) — birim + e2e.
7. Artifact SVG → görsel (smart-paste + attachments) — birim + e2e.
8. Rehber bölümü, CLAUDE.md, README; tüm testler; taze inceleme.
