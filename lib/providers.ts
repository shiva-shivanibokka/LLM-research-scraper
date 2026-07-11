import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'
import type { LanguageModel } from 'ai'
import type { ProviderId } from './provider-list'

export { PROVIDERS, isValidSelection, type ProviderId } from './provider-list'

/** Build a LanguageModel from a user-supplied key. The key is used only for
 *  this request's provider client and is never persisted or logged. */
export function getModel(provider: ProviderId, model: string, apiKey: string): LanguageModel {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(model)
    case 'openai':
      return createOpenAI({ apiKey })(model)
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(model)
    case 'groq':
      return createGroq({ apiKey })(model)
  }
}
