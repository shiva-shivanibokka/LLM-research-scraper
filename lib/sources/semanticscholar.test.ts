import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchSemanticScholar } from './semanticscholar'

afterEach(() => vi.unstubAllGlobals())

describe('fetchSemanticScholar', () => {
  it('parses an open-access paper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ paperId: 'abc', title: 'T', authors: [{ name: 'A' }], year: 2021, abstract: 'x', citationCount: 5, fieldsOfStudy: ['Medicine'], openAccessPdf: { url: 'http://pdf' } }),
    }))
    const m = await fetchSemanticScholar('DOI:10.1/x')
    expect(m.pdfUrl).toBe('http://pdf')
    expect(m.citationCount).toBe(5)
    expect(m.authors).toEqual(['A'])
  })

  it('has null pdfUrl when not open access', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ paperId: 'abc', title: 'T', authors: [], abstract: 'x' }),
    }))
    expect((await fetchSemanticScholar('x')).pdfUrl).toBeNull()
  })

  it('throws on non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }))
    await expect(fetchSemanticScholar('x')).rejects.toThrow(/404/)
  })
})
