import { resolveInput } from '@/lib/sources/resolve'
import { fetchArxiv } from '@/lib/sources/arxiv'
import { extractPdf } from '@/lib/ingest/pdf'
import { streamSummary } from '@/lib/rag/summarize'
import { getModel, isValidSelection } from '@/lib/providers'

export const maxDuration = 300

export async function POST(req: Request) {
  let payload: { input?: unknown; provider?: unknown; model?: unknown; apiKey?: unknown }
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { input, provider, model, apiKey } = payload
  if (typeof input !== 'string' || input.trim() === '') {
    return Response.json({ error: 'Provide a paper id or URL' }, { status: 400 })
  }
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    return Response.json({ error: 'Enter your API key' }, { status: 400 })
  }
  if (typeof provider !== 'string' || typeof model !== 'string' || !isValidSelection(provider, model)) {
    return Response.json({ error: 'Unsupported provider or model' }, { status: 400 })
  }

  const { source, id } = resolveInput(input)
  if (source !== 'arxiv') {
    return Response.json(
      { error: 'Phase 1 supports arXiv ids/URLs only. Semantic Scholar / DOI comes in Phase 2.' },
      { status: 400 },
    )
  }

  let meta
  try {
    meta = await fetchArxiv(id)
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }

  let body = meta.abstract
  let fullText = false
  try {
    const pages = await extractPdf(meta.pdfUrl!)
    const joined = pages.map((p) => p.text).join('\n').slice(0, 120_000)
    if (joined.length > meta.abstract.length * 2) {
      body = joined
      fullText = true
    }
  } catch {
    // fall back to abstract-only
  }

  // apiKey is used only to build this request's provider client — never stored or logged.
  const llm = getModel(provider, model, apiKey)
  return streamSummary(llm, meta, body, fullText).toTextStreamResponse({
    headers: {
      'x-paper-title': encodeURIComponent(meta.title),
      'x-full-text': String(fullText),
    },
  })
}
