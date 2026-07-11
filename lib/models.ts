// Single source of truth for model IDs. Bump here only.
// GENERATION is verified against the live API at first run; if the account
// doesn't have this id enabled, fall back to 'claude-sonnet-4-5-20250929'
// (proven working in the legacy notebook).
export const GENERATION_MODEL = 'claude-sonnet-5'
export const CHEAP_MODEL = 'claude-haiku-4-5-20251001'
export const EMBEDDING_MODEL = 'voyage-3.5'
export const EMBEDDING_DIM = 1024
