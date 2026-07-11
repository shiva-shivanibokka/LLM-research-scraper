export type Chunk = { idx: number; section: string; page: number; content: string }

// ponytail: heuristic section headers (e.g. "3 Method", "3.1 Results"). Swap for
// a layout-aware parser (grobid) only if citations point at the wrong section.
const HEADER = /^\s*(\d+(?:\.\d+)*)\s+([A-Z][A-Za-z ]{2,40})\s*$/m

/** Split per-page text into overlapping chunks, tagging each with the most
 *  recent section heading and its page number. */
export function chunkPages(
  pages: { page: number; text: string }[],
  opts: { maxChars?: number; overlap?: number } = {},
): Chunk[] {
  const maxChars = opts.maxChars ?? 3000
  const overlap = opts.overlap ?? 300
  const step = Math.max(1, maxChars - overlap)

  const chunks: Chunk[] = []
  let section = 'Body'
  let idx = 0

  for (const { page, text } of pages) {
    const h = text.match(HEADER)
    if (h) section = `${h[1]} ${h[2]}`.trim()
    for (let start = 0; start < text.length; start += step) {
      const content = text.slice(start, start + maxChars).trim()
      if (content.length < 40) continue
      chunks.push({ idx: idx++, section, page, content })
    }
  }
  return chunks
}
