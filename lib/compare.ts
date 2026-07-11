import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import { resolveInput } from './sources/resolve'

const S2_BASE = 'https://api.semanticscholar.org/graph/v1'

const schema = z.object({
  rows: z.array(z.object({ title: z.string(), approach: z.string(), finding: z.string() })),
})

export type CompareResult = { rows: { title: string; approach: string; finding: string }[]; skipped: number }

/** Pull a paper's top references from Semantic Scholar and build a comparison
 *  table (approach + key finding per paper) from their abstracts in one LLM call.
 *  ponytail: compares from abstracts, not full ingests — cheap and enough for a table. */
export async function compare(model: LanguageModel, input: string, n = 4): Promise<CompareResult> {
  const { source, id } = resolveInput(input)
  const s2id = source === 'arxiv' ? `ArXiv:${id}` : id

  const res = await fetch(`${S2_BASE}/paper/${s2id}/references?fields=title,abstract,year&limit=${n}`)
  if (!res.ok) throw new Error(`Semantic Scholar references failed (${res.status})`)
  const data: { citedPaper?: { title?: string; abstract?: string } }[] = (await res.json()).data ?? []

  const refs = data.map((d) => d.citedPaper).filter((p): p is { title: string; abstract: string } => !!p?.abstract && !!p.title)
  const skipped = data.length - refs.length
  if (refs.length === 0) return { rows: [], skipped }

  const list = refs.map((p, i) => `[${i + 1}] ${p.title}\n${p.abstract}`).join('\n\n').slice(0, 60_000)
  const { object } = await generateObject({
    model, schema,
    system: 'For each paper, give a one-sentence approach and a one-sentence key finding, grounded in its abstract.',
    prompt: list,
  })
  return { rows: object.rows, skipped }
}
