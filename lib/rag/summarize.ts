import { streamText, type LanguageModel } from 'ai'
import type { PaperMeta } from '@/lib/sources/types'

// Sections carried over verbatim from the legacy notebook's tuned prompt.
const SYSTEM = `You are a research assistant that makes academic papers accessible to a general audience.
Produce a structured markdown summary with EXACTLY these sections, each as a "## " heading:
1. What is this paper about?
2. The problem they are solving
3. Their approach
4. Key findings
5. Why it matters
6. Limitations and future directions
7. Who should read this?

When full source text is provided, cite the section you drew each claim from as [§Section].
Never invent findings that are not in the provided text. If a section cannot be answered from
what you were given, say so plainly. Respond in raw markdown — no surrounding code fences.`

export function buildSummaryPrompt(meta: PaperMeta, body: string, fullText: boolean) {
  const header = `Title: ${meta.title}\nAuthors: ${meta.authors.join(', ')}\nYear: ${meta.year ?? 'n/a'}\n`
  const note = fullText
    ? 'You have the FULL paper text below. Ground every claim in it and cite sections.'
    : 'You have ONLY the abstract below (full text was unavailable). Answer what you can and say which sections you cannot fully answer.'
  return { system: SYSTEM, user: `${note}\n\n${header}\n${body}` }
}

export function streamSummary(model: LanguageModel, meta: PaperMeta, body: string, fullText: boolean) {
  const { system, user } = buildSummaryPrompt(meta, body, fullText)
  return streamText({ model, system, prompt: user, maxOutputTokens: 1500 })
}
