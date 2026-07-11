export type PaperSource = 'arxiv' | 'semanticscholar'

export type PaperMeta = {
  source: PaperSource
  externalId: string
  title: string
  authors: string[]
  year: number | null
  abstract: string
  url: string
  /** null when no free full-text PDF is available (→ abstract-only ingestion). */
  pdfUrl: string | null
  category?: string | null
  citationCount?: number | null
  fieldsOfStudy?: string[]
}
