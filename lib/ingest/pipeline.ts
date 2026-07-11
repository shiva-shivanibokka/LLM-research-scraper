import { eq } from 'drizzle-orm'
import { resolveInput } from '@/lib/sources/resolve'
import { fetchArxiv } from '@/lib/sources/arxiv'
import { fetchSemanticScholar } from '@/lib/sources/semanticscholar'
import { extractPdf } from './pdf'
import { chunkPages } from './chunk'
import { embed } from './embed'
import { db } from '@/lib/db/client'
import { papers, chunks } from '@/lib/db/schema'

const MAX_FULLTEXT = 200_000
// Gemini's free embedding tier counts each embedded text as one quota unit, capped
// at 100/minute. A full paper chunks into well over that, so one Add-to-library blows
// the budget. Cap chunks so a single paper fits one batchEmbedContents call (100/call)
// with margin. ~90 chunks × 3000 chars still covers the whole full_text for most papers.
// ponytail: hard cap for the free tier — raise it (or remove) once on a paid Gemini key.
const MAX_CHUNKS = 90

// Postgres text/jsonb columns reject NUL bytes (0x00); PDF extraction (and, rarely,
// source metadata) can contain them, causing "invalid byte sequence for encoding
// UTF8: 0x00" and failing the insert. Strip them before anything reaches the DB.
const stripNul = (s: string) => s.replace(/\x00/g, '')

export type IngestResult = { paperId: string; title: string; fullTextAvailable: boolean }

/** Resolve → fetch metadata + full text → chunk → embed → upsert. Idempotent
 *  on (source, externalId): re-ingesting a paper replaces its chunks. */
export async function ingest(input: string, embApiKey: string): Promise<IngestResult> {
  const { source, id } = resolveInput(input)
  const meta = source === 'arxiv' ? await fetchArxiv(id) : await fetchSemanticScholar(id)

  let pages: { page: number; text: string }[] = []
  let fullText: string | null = null
  let fullTextAvailable = false
  if (meta.pdfUrl) {
    try {
      // Strip NUL at extraction so it's gone from both full_text and chunk content.
      pages = (await extractPdf(meta.pdfUrl)).map((p) => ({ ...p, text: stripNul(p.text) }))
      const joined = pages.map((p) => p.text).join('\n')
      if (joined.length > (meta.abstract?.length ?? 0) * 2) {
        fullText = joined.slice(0, MAX_FULLTEXT)
        fullTextAvailable = true
      }
    } catch {
      // fall back to abstract-only
    }
  }

  // Sanitize source free-text too (defense in depth). Deduped across insert + update.
  const abstract = stripNul(meta.abstract)
  const row = {
    title: stripNul(meta.title),
    authors: meta.authors.map(stripNul),
    year: meta.year,
    abstract,
    url: stripNul(meta.url),
    fullText,
    fullTextAvailable,
    citationCount: meta.citationCount ?? null,
  }

  const [paper] = await db
    .insert(papers)
    .values({ source: meta.source, externalId: meta.externalId, ...row })
    .onConflictDoUpdate({ target: [papers.source, papers.externalId], set: row })
    .returning()

  // Chunk full text when available, else the abstract as a single page.
  const chunkSource = fullTextAvailable ? pages : [{ page: 1, text: abstract }]
  const cks = chunkPages(chunkSource).slice(0, MAX_CHUNKS)

  await db.delete(chunks).where(eq(chunks.paperId, paper.id))
  if (cks.length > 0) {
    const vectors = await embed(cks.map((c) => c.content), embApiKey)
    await db.insert(chunks).values(
      cks.map((c, i) => ({
        paperId: paper.id,
        idx: c.idx,
        section: c.section,
        page: c.page,
        content: c.content,
        embedding: vectors[i],
      })),
    )
  }

  return { paperId: paper.id, title: meta.title, fullTextAvailable }
}
