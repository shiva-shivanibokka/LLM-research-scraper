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
      pages = await extractPdf(meta.pdfUrl)
      const joined = pages.map((p) => p.text).join('\n')
      if (joined.length > (meta.abstract?.length ?? 0) * 2) {
        fullText = joined.slice(0, MAX_FULLTEXT)
        fullTextAvailable = true
      }
    } catch {
      // fall back to abstract-only
    }
  }

  const [paper] = await db
    .insert(papers)
    .values({
      source: meta.source,
      externalId: meta.externalId,
      title: meta.title,
      authors: meta.authors,
      year: meta.year,
      abstract: meta.abstract,
      url: meta.url,
      fullText,
      fullTextAvailable,
      citationCount: meta.citationCount ?? null,
    })
    .onConflictDoUpdate({
      target: [papers.source, papers.externalId],
      set: { title: meta.title, authors: meta.authors, year: meta.year, abstract: meta.abstract, url: meta.url, fullText, fullTextAvailable, citationCount: meta.citationCount ?? null },
    })
    .returning()

  // Chunk full text when available, else the abstract as a single page.
  const chunkSource = fullTextAvailable ? pages : [{ page: 1, text: meta.abstract ?? '' }]
  const cks = chunkPages(chunkSource)

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
