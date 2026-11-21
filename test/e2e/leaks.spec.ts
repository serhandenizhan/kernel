import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, tmpVault } from './helpers/app'
import { makePng } from '../pdf/helpers'

async function makePdf(app: ElectronApplication, file: string): Promise<void> {
  const b64 = await app.evaluate(async ({ BrowserWindow }) => {
    const w = new BrowserWindow({ show: false })
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<h1>Sayfa 1</h1><div style="break-before:page"><h1>Sayfa 2</h1></div>'))
    const pdf = await w.webContents.printToPDF({})
    w.destroy()
    return pdf.toString('base64')
  })
  writeFileSync(file, Buffer.from(b64, 'base64'))
}

async function instrumentDragListeners(win: Page) {
  await win.evaluate(() => {
    const w = window as unknown as {
      __dragLeak?: {
        add: typeof window.addEventListener
        rem: typeof window.removeEventListener
        active: Map<string, Set<EventListenerOrEventListenerObject>>
      }
    }
    if (w.__dragLeak) return
    const active = new Map<string, Set<EventListenerOrEventListenerObject>>([
      ['mousemove', new Set()],
      ['mouseup', new Set()]
    ])
    const add = window.addEventListener.bind(window)
    const rem = window.removeEventListener.bind(window)
    window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) => {
      if (fn && (type === 'mousemove' || type === 'mouseup')) active.get(type)!.add(fn)
      return add(type, fn, opts)
    }) as typeof window.addEventListener
    window.removeEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | EventListenerOptions) => {
      if (fn && (type === 'mousemove' || type === 'mouseup')) active.get(type)!.delete(fn)
      return rem(type, fn, opts)
    }) as typeof window.removeEventListener
    w.__dragLeak = { add, rem, active }
  })
}

async function activeDragCounts(win: Page): Promise<{ mousemove: number; mouseup: number }> {
  return win.evaluate(() => {
    const w = window as unknown as { __dragLeak: { active: Map<string, Set<unknown>> } }
    return {
      mousemove: w.__dragLeak.active.get('mousemove')!.size,
      mouseup: w.__dragLeak.active.get('mouseup')!.size
    }
  })
}

async function navigateWithoutMouseUp(win: Page, title: string) {
  await win.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="tree-row"]'))
    const row = rows.find((el) => el.textContent?.includes(target))
    if (!row) throw new Error(`tree-row bulunamadı: ${target}`)
    row.click()
  }, title)
}

function setupMediaVault() {
  const vault = tmpVault()
  mkdirSync(join(vault, 'attachments'), { recursive: true })
  writeFileSync(join(vault, 'attachments', 'g.png'), makePng(80, 60))
  const chartJson = JSON.stringify({
    v: 1,
    type: 'bar',
    series: [{ name: 'S', color: '#14a38b' }],
    rows: [
      { label: 'A', values: [10] },
      { label: 'B', values: [20] }
    ]
  })
  writeFileSync(
    join(vault, 'Medya.md'),
    `---\ncover: attachments/g.png\n---\n\n![g](attachments/g.png)\n\n\`\`\`chart\n${chartJson}\n\`\`\`\n`
  )
  writeFileSync(join(vault, 'Diger.md'), 'bos\n')
  return vault
}

test('5.6a: ImageView boyutlandırma ortasında sayfa değişince dinleyici sızdırmaz', async () => {
  const { app, win } = await launch(setupMediaVault())
  try {
    await win.getByTestId('tree-row').filter({ hasText: 'Medya' }).click()
    await expect(win.locator('.image-resize')).toBeVisible()
    await instrumentDragListeners(win)
    const before = await activeDragCounts(win)
    await win.evaluate(() => {
      document.querySelector('.image-resize')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 200 }))
    })
    await navigateWithoutMouseUp(win, 'Diger')
    await expect(win.getByTestId('page-title')).toHaveValue('Diger')
    expect(await activeDragCounts(win)).toEqual(before)
  } finally {
    await app.close()
  }
})

test('5.6b: ChartBlock sürükleme ortasında sayfa değişince dinleyici sızdırmaz', async () => {
  const { app, win } = await launch(setupMediaVault())
  try {
    await win.getByTestId('tree-row').filter({ hasText: 'Medya' }).click()
    await expect(win.getByTestId('chart-canvas').locator('[data-row="0"]')).toBeVisible()
    await instrumentDragListeners(win)
    const before = await activeDragCounts(win)
    await win.evaluate(() => {
      const canvas = document.querySelector('[data-testid="chart-canvas"]')!
      const bar = canvas.querySelector('[data-row="0"]')!
      const r = bar.getBoundingClientRect()
      canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }))
    })
    await navigateWithoutMouseUp(win, 'Diger')
    await expect(win.getByTestId('page-title')).toHaveValue('Diger')
    expect(await activeDragCounts(win)).toEqual(before)
  } finally {
    await app.close()
  }
})

test('5.6c: PageHeader kapak konumlandırma ortasında sayfa değişince dinleyici sızdırmaz', async () => {
  const { app, win } = await launch(setupMediaVault())
  try {
    await win.getByTestId('tree-row').filter({ hasText: 'Medya' }).click()
    await expect(win.getByTestId('page-cover')).toBeVisible()
    await win.getByTestId('page-cover').hover()
    await win.getByTestId('cover-reposition').click()
    await expect(win.locator('.page-cover.repositioning')).toBeVisible()
    await instrumentDragListeners(win)
    const before = await activeDragCounts(win)
    await win.evaluate(() => {
      document.querySelector('.page-cover.repositioning')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientY: 100 }))
    })
    await navigateWithoutMouseUp(win, 'Diger')
    await expect(win.getByTestId('page-title')).toHaveValue('Diger')
    expect(await activeDragCounts(win)).toEqual(before)
  } finally {
    await app.close()
  }
})

test('5.6d: PdfEmbedView sayfadan çıkınca belgeyi ve worker’ı kapatır', async () => {
  const vault = tmpVault()
  mkdirSync(join(vault, 'attachments'), { recursive: true })
  writeFileSync(join(vault, 'Diger.md'), 'bos\n')
  const { app, win } = await launch(vault)
  try {
    await makePdf(app, join(vault, 'attachments', 'slayt.pdf'))
    writeFileSync(join(vault, 'Slayt.md'), '![[attachments/slayt.pdf]]\n')
    await win.reload()
    await win.waitForSelector('html[data-ready="1"]', { state: 'attached' })

    // Worker oluşturma ve sonlandırma sayacını kur
    await win.evaluate(() => {
      const state = { created: 0, terminated: 0 }
      ;(window as unknown as { __workerStats: typeof state }).__workerStats = state
      const OrigWorker = window.Worker
      const origTerm = OrigWorker.prototype.terminate
      OrigWorker.prototype.terminate = function (...args: []) {
        state.terminated++
        return origTerm.apply(this, args)
      }
      window.Worker = new Proxy(OrigWorker, {
        construct(target, args, newTarget) {
          state.created++
          return Reflect.construct(target, args, newTarget)
        }
      })
    })

    await win.getByTestId('tree-row').filter({ hasText: 'Slayt' }).click()
    await expect(win.getByTestId('pdf-embed').locator('canvas')).toBeVisible({ timeout: 15_000 })
    await win.getByTestId('tree-row').filter({ hasText: 'Diger' }).click()
    await expect(win.getByTestId('page-title')).toHaveValue('Diger')

    await expect
      .poll(
        () => win.evaluate(() => (window as unknown as { __workerStats: { created: number; terminated: number } }).__workerStats),
        { timeout: 5000 }
      )
      .toMatchObject({ created: 1, terminated: 1 })
  } finally {
    await app.close()
  }
})
