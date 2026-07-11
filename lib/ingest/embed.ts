import { createOpenAI } from '@ai-sdk/openai'
import { embedMany } from 'ai'
import { EMBEDDING_MODEL } from '@/lib/models'

/** Embed texts with the user's OpenAI key (BYOK — never stored). embedMany
 *  batches internally. Same call is used for documents and queries. */
export async function embed(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 0) return []
  const openai = createOpenAI({ apiKey })
  const { embeddings } = await embedMany({
    model: openai.textEmbeddingModel(EMBEDDING_MODEL),
    values: texts,
  })
  return embeddings
}
