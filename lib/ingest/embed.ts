import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embedMany } from 'ai'
import { EMBEDDING_MODEL } from '@/lib/models'

/** Embed texts with the user's Gemini key (BYOK — never stored). embedMany
 *  batches internally. Same call is used for documents and queries. */
export async function embed(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 0) return []
  const google = createGoogleGenerativeAI({ apiKey })
  const { embeddings } = await embedMany({
    model: google.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  })
  return embeddings
}
