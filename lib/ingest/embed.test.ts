import { it, expect } from 'vitest'
import { embed } from './embed'

it('returns empty for no texts (no network call)', async () => {
  expect(await embed([], 'sk-test')).toEqual([])
})
