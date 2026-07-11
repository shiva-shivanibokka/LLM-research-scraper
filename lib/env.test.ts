import { describe, it, expect, vi, beforeEach } from 'vitest'

// resetModules so env.ts re-runs its module-top validation on each re-import.
beforeEach(() => vi.resetModules())

describe('env', () => {
  it('accessing a missing lazy key throws with its name', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    delete process.env.DATABASE_URL
    const { env } = await import('./env')
    expect(() => env.DATABASE_URL).toThrow(/DATABASE_URL/)
  })

  it('returns a present key', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    process.env.VOYAGE_API_KEY = 'pa-test'
    const { env } = await import('./env')
    expect(env.VOYAGE_API_KEY).toBe('pa-test')
  })

  it('throws at import when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(import('./env')).rejects.toThrow(/ANTHROPIC_API_KEY/)
  })
})
