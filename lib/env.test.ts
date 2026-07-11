import { describe, it, expect } from 'vitest'
import { requireDatabaseUrl } from './env'

describe('requireDatabaseUrl', () => {
  it('returns the url when set', () => {
    process.env.DATABASE_URL = 'postgres://x'
    expect(requireDatabaseUrl()).toBe('postgres://x')
  })
  it('throws when missing', () => {
    delete process.env.DATABASE_URL
    expect(() => requireDatabaseUrl()).toThrow(/DATABASE_URL/)
  })
})
