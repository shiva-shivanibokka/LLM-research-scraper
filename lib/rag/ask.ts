import { generateText, type LanguageModel } from 'ai'
import type { RetrievedChunk } from './retrieve'

export type Citation = { marker: string; paperTitle: string; section: string; page: number }

/** Label retrieved chunks [C1..Cn] and build the prompt context. */
export function labelChunks(cs: RetrievedChunk[]): { context: string; citations: Citation[] } {
  const citations = cs.map((c, i) => ({
    marker: `C${i + 1}`, paperTitle: c.paperTitle, section: c.section, page: c.page,
  }))
  const context = cs
    .map((c, i) => `[C${i + 1} · ${c.paperTitle} · §${c.section} p${c.page}]\n${c.content}`)
    .join('\n\n')
  return { context, citations }
}

/** Keep only the citations the model actually referenced in its answer. Pure — unit tested. */
export function usedCitations(answer: string, citations: Citation[]): Citation[] {
  return citations.filter((c) => answer.includes(`[${c.marker}]`))
}

export async function ask(
  model: LanguageModel, question: string, cs: RetrievedChunk[],
): Promise<{ answer: string; citations: Citation[] }> {
  const { context, citations } = labelChunks(cs)
  const system = `Answer the question using ONLY the numbered sources below. After each claim, cite the source(s) you used with their [Cn] marker(s). If the sources do not contain the answer, say so plainly — do not invent.`
  const { text } = await generateText({
    model, system, prompt: `SOURCES:\n${context}\n\nQUESTION: ${question}`, maxOutputTokens: 800,
  })
  return { answer: text, citations: usedCitations(text, citations) }
}
