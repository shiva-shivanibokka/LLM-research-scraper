import { getModel } from '@/lib/providers'
import { parseLLM } from '@/lib/validate'
import { retrieve } from '@/lib/rag/retrieve'
import { ask } from '@/lib/rag/ask'
import { logEvent } from '@/lib/log'

export const maxDuration = 60

export async function POST(req: Request) {
  let payload: { question?: unknown; scope?: unknown; paperId?: unknown; embApiKey?: unknown } & Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof payload.question !== 'string' || payload.question.trim() === '') {
    return Response.json({ error: 'Enter a question' }, { status: 400 })
  }
  if (typeof payload.embApiKey !== 'string' || payload.embApiKey.trim() === '') {
    return Response.json({ error: 'Enter your OpenAI key (used for retrieval)' }, { status: 400 })
  }
  const llm = parseLLM(payload)
  if ('error' in llm) return Response.json({ error: llm.error }, { status: 400 })

  const paperId = payload.scope === 'library' ? undefined : (typeof payload.paperId === 'string' ? payload.paperId : undefined)
  try {
    const cs = await retrieve(payload.question, payload.embApiKey, { paperId, limit: 8 })
    if (cs.length === 0) {
      return Response.json({ answer: 'No indexed content found — add papers to your library first.', citations: [] })
    }
    const model = getModel(llm.provider, llm.model, llm.apiKey)
    const result = await ask(model, payload.question, cs)
    await logEvent('ask', { paperId })
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
