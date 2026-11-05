import { tNow } from './i18n'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy } from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Kasadaki PDF'i açar: baytlar arayüzde okunur (özel kernel-file:// şeması için en güvenli yol)
export async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(tNow('pdf.notFound'))
  const data = new Uint8Array(await res.arrayBuffer())
  return pdfjs.getDocument({ data }).promise
}

export type { PDFDocumentProxy }
