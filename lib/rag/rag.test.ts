import { describe, it, expect } from 'vitest'
import { aggregateVerdicts } from './faithfulness'
import { usedCitations, labelChunks, type Citation } from './ask'
import type { RetrievedChunk } from './retrieve'

describe('aggregateVerdicts', () => {
  it('scores fraction supported and lists unsupported', () => {
    const r = aggregateVerdicts([
      { claim: 'a', supported: true },
      { claim: 'b', supported: true },
      { claim: 'c', supported: true },
      { claim: 'd', supported: false },
    ])
    expect(r.score).toBe(0.75)
    expect(r.unsupported).toEqual(['d'])
  })
  it('null score with no claims', () => {
    expect(aggregateVerdicts([]).score).toBeNull()
  })
})

describe('citations', () => {
  const cited: Citation[] = [
    { marker: 'C1', paperTitle: 'P', section: 'Intro', page: 1 },
    { marker: 'C2', paperTitle: 'P', section: 'Method', page: 3 },
  ]
  it('keeps only referenced markers', () => {
    expect(usedCitations('The model uses attention [C2].', cited)).toEqual([cited[1]])
  })
  it('labels chunks with markers and metadata', () => {
    const cs: RetrievedChunk[] = [
      { id: '1', paperId: 'p', paperTitle: 'Attention', section: '3 Method', page: 5, content: 'text' },
    ]
    const { context, citations } = labelChunks(cs)
    expect(context).toContain('[C1 · Attention · §3 Method p5]')
    expect(citations[0].marker).toBe('C1')
  })
})
