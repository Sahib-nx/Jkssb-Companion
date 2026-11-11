import { GoogleGenAI } from '@google/genai'
import { BASE_SYSTEM_PROMPT } from './prompts'

const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
const FALLBACK_MODELS = ['gemini-3.8-flash']

/**
 * Returns an instance of GoogleGenAI using server-side environment variables.
 * Throws a user-friendly error if GEMINI_API_KEY is not set.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is missing from environment variables. Please add your Google Gemini API key to .env.local to enable AI features.'
    )
  }
  return new GoogleGenAI({ apiKey })
}

/**
 * Executes generateContent with automatic model fallback for 429/503 errors.
 */
async function callWithFallback(
  fn: (modelName: string) => Promise<any>,
  models: string[] = [PRIMARY_MODEL, ...FALLBACK_MODELS]
): Promise<any> {
  let lastError: any = null

  for (const model of models) {
    try {
      return await fn(model)
    } catch (err: any) {
      lastError = err
      const status = err?.status || err?.statusCode || (err?.message?.includes('429') ? 429 : 0)
      console.warn(`[AI Service] Model ${model} failed with error:`, err?.message || err)
      // Only attempt fallback for rate limits or server errors
      if (status === 429 || status === 503 || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        continue
      }
      // For invalid requests, auth errors, or prompt blocks, rethrow immediately
      throw err
    }
  }

  throw lastError || new Error('All configured AI models failed to respond.')
}

/**
 * Generates plain or HTML text content from Gemini.
 */
export async function generateTextContent(
  prompt: string,
  systemInstruction: string = BASE_SYSTEM_PROMPT
): Promise<string> {
  const ai = getGeminiClient()

  return await callWithFallback(async (modelName) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3, // Lower temperature for more factual, grounded output
      },
    })

    const text = response?.text || ''
    // Clean potential markdown wrappers if raw HTML was returned inside ```html
    return cleanCodeFences(text)
  })
}

/**
 * Generates and parses strongly typed JSON from Gemini.
 */
export async function generateStructuredJson<T>(
  prompt: string,
  systemInstruction: string = BASE_SYSTEM_PROMPT
): Promise<T> {
  const ai = getGeminiClient()

  return await callWithFallback(async (modelName) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2, // Low temperature for consistent JSON structure
        responseMimeType: 'application/json',
      },
    })

    const text = cleanCodeFences(response?.text || '{}')
    try {
      return JSON.parse(text) as T
    } catch (parseError) {
      console.error('[AI Service] Failed to parse JSON response:', text)
      throw new Error('Failed to parse AI output into structured data. Please try again.')
    }
  })
}

/**
 * Utility to strip leading and trailing markdown code block backticks
 */
function cleanCodeFences(str: string): string {
  let clean = str.trim()
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:html|json|markdown)?\s*\n?/i, '')
    clean = clean.replace(/\n?```\s*$/i, '')
  }
  return clean.trim()
}
