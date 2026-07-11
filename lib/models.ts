// Embeddings are pinned to ONE model so all vectors share a comparable space
// (pgvector columns are fixed-dimension). LLM model ids are BYOK — see
// lib/provider-list.ts. Swap these three lines to change embedding provider,
// but then the vector(DIM) column + existing rows must be regenerated.
export const EMBEDDING_PROVIDER = 'openai' as const
export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIM = 1536
