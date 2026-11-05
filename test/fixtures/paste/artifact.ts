// SENTETİK Claude artifact HTML'i (gerçek kullanıcı içeriği DEĞİL; konu: gezegenler ve sıralama algoritmaları).
// Tarayıcıdan "tümünü seç + kopyala" ile gelen yapıyı taklit eder: kartlar, terim listesi, zaman çizelgesi,
// formül kutusu, karar akışı, uyarı kutusu, tablo.
export const ARTIFACT_HTML = `<meta charset="utf-8"><style>.card{border:1px solid #ccc}</style>
<div class="page">
  <header><span class="eyebrow">Astronomi 101 · Hafta 2</span><h1>Gezegenler Özeti</h1>
  <p class="thesis">Güneş sisteminde <strong>sekiz</strong> gezegen vardır.</p></header>
  <section class="card wide"><h2>Keşif tarihi</h2>
    <div class="timeline"><span class="yr">1610</span><span><b>Galileo</b> · Jüpiter'in uyduları</span><span class="yr">1781</span><span><b>Herschel</b> · Uranüs</span></div>
  </section>
  <div class="grid">
    <section class="card"><h2>Terimler</h2>
      <dl><dt>Yörünge</dt><dd>Bir cismin izlediği yol</dd><dt>Perihel</dt><dd>Güneşe en yakın nokta, <code>q</code> ile gösterilir</dd></dl>
    </section>
    <section class="card"><h2>Formüller</h2>
      <div class="formula">v = <span>2πr / T</span><br>F = G·m1·m2 / r²</div>
      <p>Örnek: <code>T</code> = 1 yıl.</p>
    </section>
    <section class="card"><h2>Hangi sıralama?</h2>
      <div class="flow">
        <div class="step q">Veri neredeyse sıralı mı?</div>
        <div class="branches"><div class="branch"><b>EVET</b>Insertion sort</div><div class="branch"><b>HAYIR</b>Devam et</div></div>
        <div class="step q">Bellek kısıtlı mı?</div>
        <div class="branches"><div class="branch"><b>EVET</b>Heapsort</div><div class="branch"><b>HAYIR</b>Mergesort</div></div>
      </div>
    </section>
    <section class="card"><h2>Karşılaştırma</h2>
      <div class="pair"><div class="branch"><b>KAYALIK</b>Merkür, Venüs</div><div class="branch"><b>GAZ DEVİ</b>Jüpiter, Satürn</div></div>
      <div class="scroll"><table><thead><tr><th>Gezegen</th><th>Uydu</th></tr></thead><tbody><tr><td>Mars</td><td>2</td></tr></tbody></table></div>
    </section>
  </div>
  <section class="warnbox"><h2>Sık karışanlar</h2><ul><li><b>Plüton</b> artık cüce gezegen.</li><li>Ay bir gezegen değildir.</li></ul></section>
</div>`
