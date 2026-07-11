import { sql, eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { chunks, papers } from '@/lib/db/schema'
import { embed } from '@/lib/ingest/embed'

export type RetrievedChunk = {
  id: string; paperId: string; paperTitle: string; section: string; page: number; content: string
}

/** Cosine-nearest chunks to the query. Omit paperId to search the whole library. */
export async function retrieve(
  query: string, embApiKey: string, opts: { paperId?: string; limit?: number } = {},
): Promise<RetrievedChunk[]> {
  const [qv] = await embed([query], embApiKey)
  const vecLiteral = `[${qv.join(',')}]`
  const order = sql`${chunks.embedding} <=> ${vecLiteral}::vector`

  const base = db
    .select({
      id: chunks.id, paperId: chunks.paperId, paperTitle: papers.title,
      section: chunks.section, page: chunks.page, content: chunks.content,
    })
    .from(chunks)
    .innerJoin(papers, eq(papers.id, chunks.paperId))
    .$dynamic()

  const q = opts.paperId ? base.where(eq(chunks.paperId, opts.paperId)) : base
  return q.orderBy(order).limit(opts.limit ?? 8)
}
