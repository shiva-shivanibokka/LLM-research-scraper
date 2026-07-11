// Embeddings are pinned to ONE model so all vectors share a comparable space
// (pgvector columns are fixed-dimension). Gemini's free-tier embedding model.
// LLM model ids are BYOK — see lib/provider-list.ts. Swap these to change
// embedding provider, but then the vector(DIM) column + existing rows must be
// regenerated.
export const EMBEDDING_PROVIDER = 'google' as const
// gemini-embedding-001 is the current GA model (text-embedding-004 was retired).
// Its native dim is 3072; we pin it to 768 via outputDimensionality to match the
// vector(768) column. Cosine distance is scale-invariant, so no normalization needed.
export const EMBEDDING_MODEL = 'gemini-embedding-001'
export const EMBEDDING_DIM = 768
