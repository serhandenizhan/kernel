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
