import { resolveInput } from '@/lib/sources/resolve'
import { fetchArxiv } from '@/lib/sources/arxiv'
import { extractPdf } from '@/lib/ingest/pdf'
import { streamSummary } from '@/lib/rag/summarize'

export const maxDuration = 300

export async function POST(req: Request) {
  let input: unknown
  try {
    ;({ input } = await req.json())
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof input !== 'string' || input.trim() === '') {
    return Response.json({ error: 'Provide a paper id or URL' }, { status: 400 })
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
    // Only treat it as full text if it's clearly more than the abstract.
    if (joined.length > meta.abstract.length * 2) {
      body = joined
      fullText = true
    }
  } catch {
    // fall back to abstract-only
  }

  return streamSummary(meta, body, fullText).toTextStreamResponse({
    headers: {
      'x-paper-title': encodeURIComponent(meta.title),
      'x-full-text': String(fullText),
    },
  })
}
