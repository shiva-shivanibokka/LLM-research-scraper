import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'

const schema = z.object({
  claims: z.array(z.object({ claim: z.string(), supported: z.boolean() })),
})

export type FaithfulnessResult = { score: number | null; unsupported: string[] }

/** Pure aggregation — unit tested without an LLM. */
export function aggregateVerdicts(claims: { claim: string; supported: boolean }[]): FaithfulnessResult {
  if (claims.length === 0) return { score: null, unsupported: [] }
  const supported = claims.filter((c) => c.supported).length
  return {
    score: supported / claims.length,
    unsupported: claims.filter((c) => !c.supported).map((c) => c.claim),
  }
}

/** Second pass: check each summary claim against the source chunks. Returns a
 *  0–1 trust score (fraction of claims supported) plus the unsupported ones.
 *  Null score when there are no sources to verify against (abstract-only, etc.). */
export async function scoreFaithfulness(
  model: LanguageModel, summary: string, sourceChunks: string[],
): Promise<FaithfulnessResult> {
  if (sourceChunks.length === 0) return { score: null, unsupported: [] }
  const context = sourceChunks.map((c, i) => `[S${i + 1}] ${c}`).join('\n\n').slice(0, 60_000)
  const { object } = await generateObject({
    model,
    schema,
    system: 'You verify whether a summary is faithful to its sources. For each distinct factual claim in the summary, mark supported=true ONLY if the sources clearly entail it.',
    prompt: `SUMMARY:\n${summary}\n\nSOURCES:\n${context}`,
  })
  return aggregateVerdicts(object.claims)
}
