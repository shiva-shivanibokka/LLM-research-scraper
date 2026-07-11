import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embedMany } from 'ai'
import { EMBEDDING_MODEL, EMBEDDING_DIM } from '@/lib/models'

/** Embed texts with the user's Gemini key (BYOK — never stored). embedMany
 *  batches internally. Same call is used for documents and queries.
 *  outputDimensionality pins the vector length to EMBEDDING_DIM (matches the DB column). */
export async function embed(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 0) return []
  const google = createGoogleGenerativeAI({ apiKey })
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
    providerOptions: { google: { outputDimensionality: EMBEDDING_DIM } },
  })
  // Defense in depth: gemini-embedding-001 is a Matryoshka model, and its batch
  // endpoint sometimes ignores outputDimensionality (returning 3072). Truncate to
  // EMBEDDING_DIM so every vector matches the vector(EMBEDDING_DIM) column exactly.
  return embeddings.map((e) => (e.length > EMBEDDING_DIM ? e.slice(0, EMBEDDING_DIM) : e))
}
