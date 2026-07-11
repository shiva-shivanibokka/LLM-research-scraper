import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { papers, chunks, summaries } from '@/lib/db/schema'
import { getModel } from '@/lib/providers'
import { parseLLM } from '@/lib/validate'
import { generateSummary } from '@/lib/rag/summarize'
import { scoreFaithfulness } from '@/lib/rag/faithfulness'
import { logEvent } from '@/lib/log'

export const maxDuration = 60

export async function POST(req: Request) {
  let payload: { paperId?: unknown } & Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof payload.paperId !== 'string') {
    return Response.json({ error: 'paperId required' }, { status: 400 })
  }
  const llm = parseLLM(payload)
  if ('error' in llm) return Response.json({ error: llm.error }, { status: 400 })

  const [paper] = await db.select().from(papers).where(eq(papers.id, payload.paperId)).limit(1)
  if (!paper) return Response.json({ error: 'Paper not found' }, { status: 404 })

  const [cached] = await db.select().from(summaries).where(eq(summaries.paperId, paper.id)).limit(1)
  if (cached) {
    return Response.json({
      summary: cached.content, trustScore: cached.trustScore, unsupported: cached.unsupportedClaims ?? [],
      cached: true, title: paper.title, fullTextAvailable: paper.fullTextAvailable,
    })
  }

  const started = Date.now()
  const model = getModel(llm.provider, llm.model, llm.apiKey)
  const body = paper.fullText ?? paper.abstract ?? ''
  try {
    const summary = await generateSummary(
      model, { title: paper.title, authors: paper.authors, year: paper.year }, body, paper.fullTextAvailable,
    )
    const cks = await db.select({ content: chunks.content }).from(chunks).where(eq(chunks.paperId, paper.id)).limit(30)
    const { score, unsupported } = await scoreFaithfulness(model, summary, cks.map((c) => c.content))

    await db
      .insert(summaries)
      .values({ paperId: paper.id, content: summary, trustScore: score, unsupportedClaims: unsupported })
      .onConflictDoUpdate({ target: summaries.paperId, set: { content: summary, trustScore: score, unsupportedClaims: unsupported } })

    await logEvent('summarize', { paperId: paper.id, latencyMs: Date.now() - started })
    return Response.json({
      summary, trustScore: score, unsupported, cached: false,
      title: paper.title, fullTextAvailable: paper.fullTextAvailable,
    })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
