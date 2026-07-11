import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { requireDatabaseUrl } from '@/lib/env'
import * as schema from './schema'

// Lazy singleton — the connection string is read on first query, NOT at import,
// so `next build` (which evaluates route modules) doesn't need DATABASE_URL.
type DB = ReturnType<typeof drizzle<typeof schema>>
let _db: DB | null = null
function real(): DB {
  if (!_db) _db = drizzle(neon(requireDatabaseUrl()), { schema })
  return _db
}

export const db = new Proxy({} as DB, {
  get(_t, prop) {
    const d = real()
    const v = (d as unknown as Record<string | symbol, unknown>)[prop]
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(d) : v
  },
})
