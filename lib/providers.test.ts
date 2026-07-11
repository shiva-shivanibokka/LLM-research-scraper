import { describe, it, expect } from 'vitest'
import { isValidSelection, getModel, PROVIDERS } from './providers'

describe('provider registry', () => {
  it('accepts every listed provider+model pair', () => {
    for (const [p, { models }] of Object.entries(PROVIDERS)) {
      for (const m of models) expect(isValidSelection(p, m)).toBe(true)
    }
  })

  it('rejects unknown provider or model (allowlist guard)', () => {
    expect(isValidSelection('evilcorp', 'gpt-4o')).toBe(false)
    expect(isValidSelection('openai', 'not-a-model')).toBe(false)
  })

  it('builds a model object for a valid selection without calling the network', () => {
    const m = getModel('anthropic', PROVIDERS.anthropic.models[0], 'sk-test')
    expect(m).toBeTruthy()
  })
})
