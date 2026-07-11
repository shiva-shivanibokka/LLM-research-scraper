import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchArxiv } from './arxiv'
import { resolveInput } from './resolve'

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <title>Attention Is All You Need</title>
    <summary>We propose the Transformer.</summary>
    <published>2017-06-12T00:00:00Z</published>
    <author><name>Ashish Vaswani</name></author>
    <arxiv:primary_category term="cs.CL"/>
    <link type="text/html" href="https://arxiv.org/abs/1706.03762"/>
  </entry>
</feed>`

afterEach(() => vi.unstubAllGlobals())

describe('fetchArxiv', () => {
  it('parses metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => ATOM }))
    const m = await fetchArxiv('1706.03762')
    expect(m.title).toBe('Attention Is All You Need')
    expect(m.authors).toContain('Ashish Vaswani')
    expect(m.year).toBe(2017)
    expect(m.category).toBe('cs.CL')
    expect(m.pdfUrl).toBe('https://arxiv.org/pdf/1706.03762')
  })

  it('throws a clear error on non-200 (the old notebook bug)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => '' }))
    await expect(fetchArxiv('bad')).rejects.toThrow(/arXiv.*503/)
  })
})

describe('resolveInput', () => {
  it('routes arxiv ids and urls to arxiv', () => {
    expect(resolveInput('1706.03762')).toEqual({ source: 'arxiv', id: '1706.03762' })
    expect(resolveInput('https://arxiv.org/abs/1706.03762v7')).toEqual({ source: 'arxiv', id: '1706.03762' })
  })
  it('routes DOIs and hashes to semantic scholar', () => {
    expect(resolveInput('10.1038/s41586-021-03819-2')).toEqual({ source: 'semanticscholar', id: 'DOI:10.1038/s41586-021-03819-2' })
    expect(resolveInput('DOI:10.1145/1')).toEqual({ source: 'semanticscholar', id: 'DOI:10.1145/1' })
    expect(resolveInput('204e3073870fae3d05bcbc2f6a8e263d9b72e776').source).toBe('semanticscholar')
  })
})
