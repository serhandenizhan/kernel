import { test, expect, type ElectronApplication } from '@playwright/test'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'

/** Test için iki sayfalık PDF'i Electron'un kendi baskı motoruyla üretir */
async function makePdf(app: ElectronApplication, file: string): Promise<void> {
  const b64 = await app.evaluate(async ({ BrowserWindow }) => {
    const w = new BrowserWindow({ show: false })
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<h1>Birinci sayfa</h1><div style="break-before:page"><h1>İkinci sayfa</h1></div>'))
    const pdf = await w.webContents.printToPDF({})
    w.destroy()
    return pdf.toString('base64')
  })
  writeFileSync(file, Buffer.from(b64, 'base64'))
}

test('gömülü PDF sayfalar arasında gezilir, büyütülür ve / menüsünden eklenir', async () => {
  const vault = tmpVault()
  const { app, win } = await launch(vault)
  await makePdf(app, join(vault, 'attachments', 'deneme slayt.pdf'))
  writeFileSync(join(vault, 'Slayt.md'), '![[attachments/deneme slayt.pdf]]\n\nson\n')
  await win.reload()
  await win.getByTestId('tree-row').filter({ hasText: 'Slayt' }).click()
  const block = win.getByTestId('pdf-embed')
  await expect(block.locator('canvas')).toBeVisible({ timeout: 15_000 })
  await expect(block.getByTestId('pdf-page')).toHaveText('1 / 2')
  await block.getByTestId('pdf-next').click()
  await expect(block.getByTestId('pdf-page')).toHaveText('2 / 2')
  await block.getByTestId('pdf-expand').click()
  await expect(win.getByTestId('pdf-modal').locator('canvas')).toBeVisible()
  await win.keyboard.press('Escape')
  await expect(win.getByTestId('pdf-modal')).toHaveCount(0)

  // / menüsünden PDF ekle
  await win.getByText('son', { exact: true }).click()
  await win.keyboard.press('End')
  await win.keyboard.press('Enter')
  const chooser = win.waitForEvent('filechooser')
  await win.keyboard.type('/pdf')
  await win.keyboard.press('Enter')
  await (await chooser).setFiles({ name: 'ek.pdf', mimeType: 'application/pdf', buffer: readFileSync(join(vault, 'attachments', 'deneme slayt.pdf')) })
  await expect(win.getByTestId('pdf-embed')).toHaveCount(2)
  await expect.poll(() => readdirSync(join(vault, 'attachments')).some((f) => /^ek-\w+\.pdf$/.test(f))).toBe(true)
  await expect.poll(() => readFileSync(join(vault, 'Slayt.md'), 'utf8'), { timeout: 5000 }).toMatch(/!\[\[attachments\/ek-\w+\.pdf\]\]/)
  expect(existsSync(join(vault, 'attachments', 'deneme slayt.pdf'))).toBe(true)
  await app.close()
})
