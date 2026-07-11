import { db } from './db/client'
import { events } from './db/schema'

/** Structured stdout log + a durable events row for the metrics page.
 *  Never throws — observability must not break the request. */
export async function logEvent(action: string, data: { paperId?: string; latencyMs?: number } = {}) {
  console.log(JSON.stringify({ level: 'info', action, ...data }))
  try {
    await db.insert(events).values({ action, paperId: data.paperId ?? null, latencyMs: data.latencyMs ?? null })
  } catch {
    // best effort
  }
}
