import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { papers, summaries, events } from '@/lib/db/schema'

export async function GET() {
  const [{ n: paperCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(papers)
  const [{ n: summaryCount, avgTrust }] = await db
    .select({ n: sql<number>`count(*)::int`, avgTrust: sql<number | null>`avg(trust_score)` })
    .from(summaries)
  const latency = await db
    .select({ action: events.action, avgMs: sql<number | null>`avg(latency_ms)::int`, n: sql<number>`count(*)::int` })
    .from(events)
    .groupBy(events.action)

  return Response.json({
    papers: paperCount,
    summaries: summaryCount,
    avgTrust: avgTrust === null ? null : Number(avgTrust),
    latency,
  })
}
