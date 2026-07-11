// Central env access. ANTHROPIC_API_KEY is validated eagerly (fail loudly at
// startup — every generation path needs it). VOYAGE_API_KEY and DATABASE_URL
// are validated lazily on first access so Phase 1 (arXiv + summarize) runs
// before Neon/Voyage are provisioned.
// ponytail: lazy getters instead of an all-or-nothing zod parse, so the app
// boots without the datastore keys until the features that need them are built.

function required(name: string): string {
  const v = process.env[name]
  if (!v || v.trim() === '') throw new Error(`Missing required env: ${name}`)
  return v
}

// Eager: crash on boot if the always-needed key is absent.
required('ANTHROPIC_API_KEY')

export const env = {
  ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),
  get VOYAGE_API_KEY(): string {
    return required('VOYAGE_API_KEY')
  },
  get DATABASE_URL(): string {
    return required('DATABASE_URL')
  },
}
