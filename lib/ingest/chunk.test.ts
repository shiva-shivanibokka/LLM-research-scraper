import { describe, it, expect } from 'vitest'
import { chunkPages } from './chunk'

describe('chunkPages', () => {
  it('splits long pages into overlapping chunks with page + section', () => {
    const pages = [{ page: 1, text: '3 Method\n' + 'x '.repeat(1200) }]
    const chunks = chunkPages(pages, { maxChars: 800, overlap: 100 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].page).toBe(1)
    expect(chunks[0].idx).toBe(0)
    expect(chunks[0].section.toLowerCase()).toContain('method')
    expect(chunks.every((c) => c.content.length <= 800)).toBe(true)
  })

  it('returns empty for empty input', () => {
    expect(chunkPages([])).toEqual([])
  })

  it('skips near-empty slices', () => {
    expect(chunkPages([{ page: 1, text: 'tiny' }])).toEqual([])
  })
})
