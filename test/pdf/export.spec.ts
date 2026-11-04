import { test, expect, type Page } from '@playwright/test'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'
import { launch, tmpVault } from '../e2e/helpers/app'
import { imageSizes, makePng, openPdf, outlineTitles, pageText, renderPng } from './helpers'

const BASELINE = join('test', 'pdf', 'baseline')
const FIXTURES = join('test', 'pdf', 'fixtures')

async function exportVia(win: Page, title: string, options: Record<string, unknown> = {}) {
  await win.getByTestId('tree-row').filter({ hasText: title }).click()
  await expect(win.getByTestId('editor')).toBeVisible()
  await win.keyboard.press('Meta+e')
  await expect(win.getByTestId('export-dialog')).toBeVisible()
  for (const [k, v] of Object.entries(options)) {
    const el = win.getByTestId(`pdf-${k}`)
    if (typeof v === 'boolean') await (v ? el.check() : el.uncheck())
    else await el.selectOption(String(v))
  }
  await win.getByTestId('pdf-export').click()
  await expect(win.getByTestId('toast').filter({ hasText: 'PDF kaydedildi' })).toBeVisible({ timeout: 30_000 })
}

test('karışık içerikli sayfa vektörel, görselleri tam çözünürlükte ve kaymasız PDF olur', async () => {
  const vault = tmpVault()
  const out = mkdtempSync(join(tmpdir(), 'kernel-pdf-'))
  mkdirSync(join(vault, 'attachments'), { recursive: true })
  writeFileSync(join(vault, 'attachments', 'örnek görsel ş.png'), makePng(400, 300))
  copyFileSync(join(FIXTURES, 'mixed.md'), join(vault, 'Lineer Cebir.md'))
  const { app, win } = await launch(vault, { KERNEL_TEST_PDF_DIR: out })
  await exportVia(win, 'Lineer Cebir', { pageNumbers: false })
  const file = join(out, 'Lineer Cebir.pdf')
  expect(existsSync(file)).toBe(true)
  await app.close()

  const pdf = await openPdf(file)
  expect(pdf.numPages).toBeGreaterThan(0)
  const text = (await Promise.all(Array.from({ length: pdf.numPages }, (_, i) => pageText(pdf, i + 1)))).join(' ')
  // metin vektörel (seçilebilir) olarak gömülü
  expect(text).toContain('Özdeğerler')
  expect(text).toContain('Toggle içeriği PDF')
  expect(text).toContain('np.linalg.eig')
  // içindekiler (outline)
  expect(await outlineTitles(pdf)).toEqual(expect.arrayContaining(['Lineer Cebir', 'Özdeğerler', 'Kod örneği']))
  // görsel küçültülmeden gömülü
  const sizes = (await Promise.all(Array.from({ length: pdf.numPages }, (_, i) => imageSizes(pdf, i + 1)))).flat()
  expect(sizes).toContainEqual({ width: 400, height: 300 })

  // görsel regresyon: referans PNG'lerle piksel karşılaştırması
  mkdirSync(BASELINE, { recursive: true })
  for (let n = 1; n <= pdf.numPages; n++) {
    const actual = await renderPng(pdf, n)
    const basePath = join(BASELINE, `mixed-p${n}.png`)
    if (!existsSync(basePath)) {
      writeFileSync(basePath, PNG.sync.write(actual))
      continue
    }
    const base = PNG.sync.read(readFileSync(basePath))
    expect([actual.width, actual.height]).toEqual([base.width, base.height])
    const diff = pixelmatch(actual.data, base.data, null, base.width, base.height, { threshold: 0.15 })
    expect(diff / (base.width * base.height)).toBeLessThan(0.005)
  }
})

test('uzun kod bloğu bölünür ama kısa kod bloğu iki sayfaya bölünmez; alt sayfalar birleştirilir', async () => {
  const vault = tmpVault()
  const out = mkdtempSync(join(tmpdir(), 'kernel-pdf-'))
  const filler = Array.from({ length: 34 }, (_, i) => `Dolgu paragrafı ${i} — sayfayı doldurmak için.`).join('\n\n')
  const shortCode = Array.from({ length: 12 }, (_, i) => `kisa_satir_${i} = ${i}`).join('\n')
  const longCode = Array.from({ length: 90 }, (_, i) => `uzun_satir_${i} = ${i}`).join('\n')
  writeFileSync(join(vault, 'Kod.md'), `${filler}\n\n\`\`\`python\n${shortCode}\n\`\`\`\n\n\`\`\`python\n${longCode}\n\`\`\`\n`)
  mkdirSync(join(vault, 'Kod'))
  writeFileSync(join(vault, 'Kod', 'Ek.md'), 'alt sayfa içeriği\n')
  const { app, win } = await launch(vault, { KERNEL_TEST_PDF_DIR: out })
  await exportVia(win, 'Kod', { includeSubpages: true, pageNumbers: true })
  await app.close()

  const pdf = await openPdf(join(out, 'Kod.pdf'))
  const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_, i) => pageText(pdf, i + 1)))
  const pageOf = (s: string) => pages.findIndex((p) => p.includes(s))
  expect(pageOf('kisa_satir_0')).toBe(pageOf('kisa_satir_11'))
  expect(pageOf('uzun_satir_89')).toBeGreaterThan(pageOf('uzun_satir_0'))
  // devam parçasında dil etiketi tekrarlanır
  expect(pages[pageOf('uzun_satir_89')]).toContain('devam')
  // alt sayfa yeni sayfadan başlar
  expect(pages[pdf.numPages - 1]).toContain('alt sayfa içeriği')
  // sayfa numarası
  expect(pages[0]).toMatch(new RegExp(`1 / ${pdf.numPages}`))
})
