import { isValidSelection, type ProviderId } from './providers'

export type LLMSelection = { provider: ProviderId; model: string; apiKey: string }

/** Validate the BYOK fields shared by summarize/ask/compare. Returns the
 *  selection or an error message (never throws, never logs the key). */
export function parseLLM(p: Record<string, unknown>): LLMSelection | { error: string } {
  const { provider, model, apiKey } = p as { provider?: unknown; model?: unknown; apiKey?: unknown }
  if (typeof apiKey !== 'string' || apiKey.trim() === '') return { error: 'Enter your API key' }
  if (typeof provider !== 'string' || typeof model !== 'string' || !isValidSelection(provider, model)) {
    return { error: 'Unsupported provider or model' }
  }
  return { provider, model, apiKey }
}
