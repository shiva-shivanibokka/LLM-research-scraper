import { ingest } from '@/lib/ingest/pipeline'
import { logEvent } from '@/lib/log'

export const maxDuration = 60

export async function POST(req: Request) {
  let payload: { input?: unknown; embApiKey?: unknown }
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { input, embApiKey } = payload
  if (typeof input !== 'string' || input.trim() === '') {
    return Response.json({ error: 'Provide a paper id or URL' }, { status: 400 })
  }
  if (typeof embApiKey !== 'string' || embApiKey.trim() === '') {
    return Response.json({ error: 'Enter your Gemini key (used for embeddings)' }, { status: 400 })
  }

  const started = Date.now()
  try {
    const result = await ingest(input, embApiKey)
    await logEvent('ingest', { paperId: result.paperId, latencyMs: Date.now() - started })
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
