import type { PaperMeta } from './types'

const S2_BASE = 'https://api.semanticscholar.org/graph/v1'
const FIELDS = 'title,authors,year,abstract,citationCount,fieldsOfStudy,externalIds,openAccessPdf'

/** Fetch metadata from Semantic Scholar. Full text is only available when the
 *  paper is open-access (`openAccessPdf`); otherwise pdfUrl is null and the
 *  paper is ingested abstract-only. `id` may be a raw hash, DOI:..., or ArXiv:... */
export async function fetchSemanticScholar(id: string): Promise<PaperMeta> {
  // Do NOT url-encode — S2 accepts prefixed ids (DOI:10.x/y) raw in the path.
  const res = await fetch(`${S2_BASE}/paper/${id}?fields=${FIELDS}`)
  if (!res.ok) throw new Error(`Semantic Scholar request failed (${res.status}) for ${id}`)
  const d = await res.json()

  const authors = Array.isArray(d.authors) ? d.authors.map((a: { name?: string }) => a?.name).filter(Boolean) : []
  return {
    source: 'semanticscholar',
    externalId: id,
    title: d.title ?? 'Unknown title',
    authors,
    year: typeof d.year === 'number' ? d.year : null,
    abstract: d.abstract ?? '',
    url: d.paperId ? `https://www.semanticscholar.org/paper/${d.paperId}` : '',
    pdfUrl: d.openAccessPdf?.url ?? null,
    citationCount: typeof d.citationCount === 'number' ? d.citationCount : null,
    fieldsOfStudy: Array.isArray(d.fieldsOfStudy) ? d.fieldsOfStudy : [],
  }
}
