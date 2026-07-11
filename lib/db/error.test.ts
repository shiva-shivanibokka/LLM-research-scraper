import { describe, it, expect } from 'vitest'
import { dbErrorMessage } from './error'

describe('dbErrorMessage', () => {
  it('digs the real Postgres reason out of a wrapped drizzle error', () => {
    const cause = Object.assign(new Error('there is no unique or exclusion constraint matching the ON CONFLICT specification'), { code: '42P10' })
    const wrapped = Object.assign(new Error('Failed query: insert into "papers" ... params: arxiv,2303.08774,...'), { cause })
    const msg = dbErrorMessage(wrapped)
    expect(msg).toContain('no unique or exclusion constraint')
    expect(msg).toContain('42P10')
    expect(msg).not.toContain('Failed query') // the noisy params dump is gone
  })

  it('falls back to the message when there is no cause', () => {
    expect(dbErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('stringifies non-Errors', () => {
    expect(dbErrorMessage('nope')).toBe('nope')
  })
})
