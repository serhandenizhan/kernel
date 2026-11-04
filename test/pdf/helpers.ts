import { readFileSync } from 'node:fs'
import { createCanvas } from '@napi-rs/canvas'
import { PNG } from 'pngjs'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'

export async function openPdf(path: string) {
  const data = new Uint8Array(readFileSync(path))
  return getDocument({ data, useSystemFonts: false }).promise
}

type Pdf = Awaited<ReturnType<typeof openPdf>>

export async function pageText(pdf: Pdf, n: number): Promise<string> {
  const page = await pdf.getPage(n)
  const tc = await page.getTextContent()
  return tc.items.map((i) => ('str' in i ? i.str : '')).join(' ')
}

export async function outlineTitles(pdf: Pdf): Promise<string[]> {
  const out: string[] = []
  const walk = (items: { title: string; items: unknown[] }[] | null) => {
    for (const it of items ?? []) {
      out.push(it.title)
      walk(it.items as never)
    }
  }
  walk((await pdf.getOutline()) as never)
  return out
}

/** Sayfadaki görsel nesnelerinin piksel boyutları */
export async function imageSizes(pdf: Pdf, n: number): Promise<{ width: number; height: number }[]> {
  const page = await pdf.getPage(n)
  const ops = await page.getOperatorList()
  const sizes: { width: number; height: number }[] = []
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === OPS.paintImageXObject) {
      const name = ops.argsArray[i][0] as string
      const img = await new Promise<{ width: number; height: number }>((resolve) => (page.objs.has(name) ? resolve(page.objs.get(name)) : page.objs.get(name, resolve)))
      sizes.push({ width: img.width, height: img.height })
    }
  }
  return sizes
}

export async function renderPng(pdf: Pdf, n: number, scale = 1.5): Promise<PNG> {
  const page = await pdf.getPage(n)
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas: canvas as never, canvasContext: ctx as never, viewport }).promise
  return PNG.sync.read(canvas.toBuffer('image/png'))
}

/** Test için düz renk geçişli PNG üretir */
export function makePng(width: number, height: number): Buffer {
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      png.data[i] = Math.round((x / width) * 255)
      png.data[i + 1] = 124
      png.data[i + 2] = Math.round((y / height) * 255)
      png.data[i + 3] = 255
    }
  return PNG.sync.write(png)
}
