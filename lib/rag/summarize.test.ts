import { describe, it, expect } from 'vitest'
import { buildSummaryPrompt } from './summarize'
import type { PaperMeta } from '@/lib/sources/types'

const meta: PaperMeta = {
  source: 'arxiv', externalId: 'x', title: 'T', authors: ['A'], year: 2020,
  abstract: 'a', url: '', pdfUrl: null,
}

describe('buildSummaryPrompt', () => {
  it('flags abstract-only mode', () => {
    const { user } = buildSummaryPrompt(meta, 'a', false)
    expect(user.toLowerCase()).toContain('only the abstract')
  })
  it('uses full-text framing when available', () => {
    const { user, system } = buildSummaryPrompt(meta, 'full body', true)
    expect(user.toLowerCase()).toContain('full paper text')
    expect(system).toContain('Limitations and future directions')
  })
})
