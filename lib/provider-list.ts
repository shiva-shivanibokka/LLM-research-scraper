// Client-safe provider/model data (no SDK imports — importable in the browser).
// Edit model ids here as providers ship new ones.
export const PROVIDERS = {
  anthropic: {
    label: 'Anthropic',
    models: ['claude-sonnet-4-5-20250929', 'claude-opus-4-1-20250805', 'claude-3-5-haiku-20241022'],
  },
  openai: {
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini'],
  },
  google: {
    label: 'Google Gemini',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
  },
  groq: {
    label: 'Groq',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  },
} as const

export type ProviderId = keyof typeof PROVIDERS

export function isValidSelection(provider: string, model: string): provider is ProviderId {
  const p = (PROVIDERS as Record<string, { models: readonly string[] }>)[provider]
  return !!p && p.models.includes(model)
}
