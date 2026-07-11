import type { PaperSource } from './types'

/**
 * Turn whatever the user pasted (arXiv id, arXiv URL, DOI, S2 hash, or a title)
 * into a source + id. arXiv ids/URLs route to arXiv; everything else routes to
 * Semantic Scholar, which understands DOI:/ArXiv: prefixes, its own 40-hex
 * hashes, and free-text search.
 */
export function resolveInput(input: string): { source: PaperSource; id: string } {
  const s = input.trim()

  const abs = s.match(/arxiv\.org\/(?:abs|pdf)\/([\w.\/-]+?)(?:v\d+)?\/?$/i)
  if (abs) return { source: 'arxiv', id: abs[1] }

  if (/^\d{4}\.\d{4,5}$/.test(s)) return { source: 'arxiv', id: s }

  if (/^(DOI:|ArXiv:)/i.test(s)) return { source: 'semanticscholar', id: s }
  if (/^10\.\d{4,}\//.test(s)) return { source: 'semanticscholar', id: `DOI:${s}` }
  if (/^[0-9a-f]{40}$/i.test(s)) return { source: 'semanticscholar', id: s }

  return { source: 'semanticscholar', id: s }
}
