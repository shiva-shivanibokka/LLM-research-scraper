import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { EMBEDDING_MODEL, EMBEDDING_DIM } from '@/lib/models'

// Temporary diagnostic: reports the actual chunks.embedding column type so we
// can confirm the vector dimension the DB expects vs. what the code produces.
export async function GET() {
  try {
    const col = await db.execute(
      sql`SELECT format_type(atttypid, atttypmod) AS embedding_type FROM pg_attribute WHERE attrelid = 'chunks'::regclass AND attname = 'embedding'`,
    )
    const counts = await db.execute(
      sql`SELECT (SELECT count(*)::int FROM papers) AS papers, (SELECT count(*)::int FROM chunks) AS chunks`,
    )
    return Response.json({
      expectedByCode: { model: EMBEDDING_MODEL, dim: EMBEDDING_DIM },
      dbColumn: col.rows?.[0] ?? col,
      counts: counts.rows?.[0] ?? counts,
    })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

