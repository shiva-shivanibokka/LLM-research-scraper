import { desc, eq } from 'drizzle-orm'
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

// Remove a paper (its chunks + summary cascade via FK onDelete).
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  await db.delete(papers).where(eq(papers.id, id))
  return Response.json({ ok: true })
}
