import { desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { papers } from '@/lib/db/schema'

export async function GET() {
  const rows = await db
    .select({
      id: papers.id, title: papers.title, authors: papers.authors, year: papers.year,
      fullTextAvailable: papers.fullTextAvailable, citationCount: papers.citationCount,
    })
    .from(papers)
    .orderBy(desc(papers.createdAt))
    .limit(200)
  return Response.json({ papers: rows })
}
