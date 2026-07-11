import { getModel } from '@/lib/providers'
import { parseLLM } from '@/lib/validate'
import { compare } from '@/lib/compare'
import { logEvent } from '@/lib/log'

export const maxDuration = 60

export async function POST(req: Request) {
  let payload: { input?: unknown; n?: unknown } & Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof payload.input !== 'string' || payload.input.trim() === '') {
    return Response.json({ error: 'Provide a paper id or URL' }, { status: 400 })
  }
  const llm = parseLLM(payload)
  if ('error' in llm) return Response.json({ error: llm.error }, { status: 400 })

  const n = typeof payload.n === 'number' ? Math.min(Math.max(1, payload.n), 8) : 4
  try {
    const model = getModel(llm.provider, llm.model, llm.apiKey)
    const result = await compare(model, payload.input, n)
    await logEvent('compare')
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
