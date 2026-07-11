import { extractText, getDocumentProxy } from 'unpdf'

/** Download a PDF and return its text split per page (page numbers are 1-based). */
export async function extractPdf(pdfUrl: string): Promise<{ page: number; text: string }[]> {
  const res = await fetch(pdfUrl)
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status}) for ${pdfUrl}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  const pdf = await getDocumentProxy(buf)
  const { text } = await extractText(pdf, { mergePages: false })
  const pages = Array.isArray(text) ? text : [text]
  return pages.map((t, i) => ({ page: i + 1, text: t ?? '' }))
}
