import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { papers, chunks, summaries } from '@/lib/db/schema'
import { getModel } from '@/lib/providers'
import { parseLLM } from '@/lib/validate'
import { generateSummary } from '@/lib/rag/summarize'
import { scoreFaithfulness } from '@/lib/rag/faithfulness'
import { dbErrorMessage } from '@/lib/db/error'
import { logEvent } from '@/lib/log'

export const maxDuration = 60

// Best-effort faithfulness scoring. Never throws — a rate-limit or structured-output
// hiccup on this second model call must not break the summary; it just leaves trust
// unscored, and logs why so we can tell the two apart.
async function tryScore(model: ReturnType<typeof getModel>, paperId: string, summaryText: string) {
  try {
    const cks = await db.select({ content: chunks.content }).from(chunks).where(eq(chunks.paperId, paperId)).limit(30)
    return await scoreFaithfulness(model, summaryText, cks.map((c) => c.content))
  } catch (e) {
    console.error('faithfulness scoring failed:', e instanceof Error ? e.message : e)
    return { score: null as number | null, unsupported: [] as string[] }
  }
}

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

  const model = getModel(llm.provider, llm.model, llm.apiKey)

  const [cached] = await db.select().from(summaries).where(eq(summaries.paperId, paper.id)).limit(1)
  if (cached) {
    let trustScore = cached.trustScore
    let unsupported = cached.unsupportedClaims ?? []
    // A cached summary whose scoring failed the first time (trust null) gets one
    // more attempt now — just the score, no re-summarizing. Fixes trust being stuck.
    if (trustScore === null) {
      const r = await tryScore(model, paper.id, cached.content)
      if (r.score !== null) {
        trustScore = r.score
        unsupported = r.unsupported
        await db.update(summaries).set({ trustScore: r.score, unsupportedClaims: r.unsupported }).where(eq(summaries.paperId, paper.id))
      }
    }
    return Response.json({
      summary: cached.content, trustScore, unsupported,
      cached: true, title: paper.title, fullTextAvailable: paper.fullTextAvailable,
    })
  }

  const started = Date.now()
  const body = paper.fullText ?? paper.abstract ?? ''
  try {
    const summary = await generateSummary(
      model, { title: paper.title, authors: paper.authors, year: paper.year }, body, paper.fullTextAvailable,
    )
    if (!summary.trim()) {
      return Response.json({ error: 'The model returned an empty summary — try again, or pick a different model.' }, { status: 502 })
    }

    const { score, unsupported } = await tryScore(model, paper.id, summary)

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
    return Response.json({ error: dbErrorMessage(e) }, { status: 502 })
  }
}
