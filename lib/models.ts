// Embeddings are pinned to ONE model so all vectors share a comparable space
// (pgvector columns are fixed-dimension). Gemini's free-tier embedding model.
// LLM model ids are BYOK — see lib/provider-list.ts. Swap these to change
// embedding provider, but then the vector(DIM) column + existing rows must be
// regenerated.
export const EMBEDDING_PROVIDER = 'google' as const
export const EMBEDDING_MODEL = 'text-embedding-004'
export const EMBEDDING_DIM = 768
