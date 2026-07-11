import { XMLParser } from 'fast-xml-parser'
import type { PaperMeta } from './types'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

/**
 * Fetch paper metadata from the arXiv Atom API.
 * Unlike the legacy notebook, this checks the HTTP status before parsing, so a
 * bad id or an arXiv outage produces a clear error instead of a raw XML crash.
 */
export async function fetchArxiv(id: string): Promise<PaperMeta> {
  const res = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`arXiv request failed (${res.status}) for id ${id}`)

  const feed = parser.parse(await res.text())?.feed
  const raw = feed?.entry
  const entry = Array.isArray(raw) ? raw[0] : raw
  if (!entry || !entry.title) throw new Error(`No arXiv paper found for id ${id}`)

  const authors = ([] as any[])
    .concat(entry.author ?? [])
    .map((a) => a?.name)
    .filter(Boolean)

  const primary = ([] as any[]).concat(entry['arxiv:primary_category'] ?? [])[0]
  const category = primary?.['@_term'] ?? null

  const year = entry.published ? new Date(entry.published).getFullYear() : null

  return {
    source: 'arxiv',
    externalId: id,
    title: String(entry.title).trim(),
    authors,
    year: Number.isFinite(year as number) ? (year as number) : null,
    abstract: String(entry.summary ?? '').trim(),
    url: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    category,
  }
}
