import { test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

// README ekran görüntüleri: yalnızca KERNEL_SCREENSHOTS=1 ile çalışır; kasa içeriği burada sıfırdan yazılır
test.skip(!process.env['KERNEL_SCREENSHOTS'], 'yalnızca README görüntüleri için')

test('README ekran görüntüleri', async () => {
  const vault = tmpVault()
  const w = (p: string, s: string) => writeFileSync(join(vault, p), s)
  w('Lineer Cebir.md', '---\nicon: "🧮"\n---\n## Özdeğerler\n\nBir $A$ matrisi için $Av = \\lambda v$ sağlayan $\\lambda$ sayılarına **özdeğer** denir.\n\n$$\n\\det(A - \\lambda I) = 0\n$$\n\n> [!tip] İpucu\n> Karakteristik polinomun kökleri özdeğerleri verir. #vize\n\nÖzdeğer nedir? :: $Av = \\lambda v$ sağlayan $\\lambda$\n\nBkz. [[Determinant]] ve [[Matris Çarpımı]].\n')
  mkdirSync(join(vault, 'Lineer Cebir'))
  w('Lineer Cebir/Determinant.md', 'Determinant, kare matrisin hacim ölçeğidir. [[Matris Çarpımı]] #vize\n\nDeterminant sıfırsa? :: Matris tersinir değildir\n')
  w('Lineer Cebir/Matris Çarpımı.md', 'Satır × sütun. #final\n')
  w('Fizik.md', '---\nicon: "🪐"\n---\n## Newton yasaları\n\n```python\ndef kuvvet(m, a):\n    return m * a\n```\n\nNewton 2 :: $F = ma$\n')
  w('Algoritmalar.md', '---\nicon: "🧠"\n---\nİkili arama $O(\\log n)$. [[Fizik]] #final\n')
  const { app, win } = await launch(vault, {}, { home: true })
  await win.setViewportSize({ width: 1280, height: 800 })
  const out = (n: string) => join(process.cwd(), 'docs', 'screenshots', n)
  await win.waitForTimeout(800)
  await win.screenshot({ path: out('home.png') })
  await win.getByTestId('tree-row').filter({ hasText: 'Lineer Cebir' }).first().click()
  await win.waitForTimeout(800)
  await win.screenshot({ path: out('editor.png') })
  await win.getByTestId('nav-graph').click()
  await win.waitForTimeout(2000)
  await win.screenshot({ path: out('graph.png') })
  await app.close()
})

test('README grafik görüntüleri', async () => {
  const vault = tmpVault()
  const w = (p: string, s: string) => writeFileSync(join(vault, p), s)
  const chart = (o: object) => '```chart\n' + JSON.stringify(o) + '\n```\n'
  w(
    'Bütçe.md',
    '---\nicon: "💰"\n---\n## Kasım\n\nGelirin nereye gittiği:\n\n' +
      chart({ type: 'donut', title: 'Aylık harcama', unit: '%', series: [{ name: '', color: '#14a38b' }], rows: [{ label: 'Kira', values: [45], color: '#14a38b' }, { label: 'Yemek', values: [25], color: '#4f7cff' }, { label: 'Ulaşım', values: [15], color: '#f0a020' }, { label: 'Eğlence', values: [15], color: '#e5577a' }] }) +
      '\n## Haftalık çalışma\n\n' +
      chart({ type: 'area', unit: ' sa', series: [{ name: 'Matematik', color: '#4f7cff' }, { name: 'Fizik', color: '#14a38b' }], rows: [{ label: 'Pzt', values: [2, 1] }, { label: 'Sal', values: [3, 1.5] }, { label: 'Çar', values: [2.5, 2] }, { label: 'Per', values: [4, 2.5] }, { label: 'Cum', values: [3.5, 3] }] })
  )
  w(
    'Sınav planı.md',
    '---\nicon: "🎯"\n---\n## Çalışma döngüsü\n\n' +
      chart({ type: 'flow', nodes: [{ id: 'a', label: 'Konuyu çalış', shape: 'round' }, { id: 'b', label: 'Soru çöz', shape: 'box' }, { id: 'c', label: 'Hata var mı?', shape: 'diamond' }, { id: 'd', label: 'Tekrar et', shape: 'box' }, { id: 'e', label: 'Sınava hazır', shape: 'round' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd', label: 'evet' }, { from: 'c', to: 'e', label: 'hayır' }, { from: 'd', to: 'b' }] }) +
      '\n## Vektörler\n\n' +
      chart({ type: 'plane', z: true, connect: true, points: [{ label: 'A', x: 2, y: 1, z: 3 }, { label: 'B', x: -1, y: 3, z: 1 }, { label: 'C', x: 3, y: -2, z: 2 }] })
  )
  const { app, win } = await launch(vault)
  await win.setViewportSize({ width: 1280, height: 800 })
  const out = (n: string) => join(process.cwd(), 'docs', 'screenshots', n)
  await win.getByTestId('tree-row').filter({ hasText: 'Bütçe' }).click()
  await win.waitForTimeout(600)
  await win.getByTestId('chart-block').first().hover()
  await win.getByTestId('chart-edit').first().click()
  await win.waitForTimeout(400)
  await win.locator('.page-surface').first().evaluate((e) => e.scrollTo(0, 150))
  await win.waitForTimeout(300)
  await win.screenshot({ path: out('charts.png') })
  await win.getByTestId('tree-row').filter({ hasText: 'Sınav planı' }).click()
  await win.waitForTimeout(700)
  await win.getByTestId('toc-rail').hover()
  await win.waitForTimeout(300)
  await win.screenshot({ path: out('diagrams.png') })
  await app.close()
})
