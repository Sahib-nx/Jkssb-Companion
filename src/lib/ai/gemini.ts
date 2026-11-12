import { GoogleGenAI } from '@google/genai'
import { BASE_SYSTEM_PROMPT } from './prompts'
import { GEMINI_CONFIG } from './config'

/**
 * Executes a Promise with a hard timeout deadline.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutErrorMsg: string): Promise<T> {
  let timer: NodeJS.Timeout
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(timeoutErrorMsg)
      err.name = 'TimeoutError'
      reject(err)
    }, timeoutMs)
  })

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise,
  ])
}

/**
 * Returns an instance of GoogleGenAI using the provided user API key.
 * Throws a user-friendly error if apiKey is not provided.
 * Under BYOK architecture, keys are NEVER shared or retrieved from global env defaults.
 */
export function getGeminiClient(apiKey: string): GoogleGenAI {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    throw new Error(
      'NO_API_KEY: Google Gemini API key is missing. Please connect your personal Gemini API key in Settings.'
    )
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() })
}

/**
 * Standardizes errors from the Gemini API into human-friendly explanations.
 */
function handleGeminiError(err: any): never {
  const status = err?.status || err?.statusCode || 0
  const msg = err?.message || ''

  if (err?.name === 'TimeoutError' || msg.includes('timed out')) {
    throw new Error(
      `AI generation request timed out after ${GEMINI_CONFIG.GENERATION_TIMEOUT_MS / 1000} seconds. Please try again with shorter notes or retry in a moment.`
    )
  }

  if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    throw new Error(
      'Google Gemini rate limit or quota exceeded for your personal API key. Please check your quota on Google AI Studio or wait a moment before trying again.'
    )
  }

  if (status === 400 || status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('unregistered')) {
    throw new Error(
      'Invalid Google Gemini API key. Please verify or reconnect your key in Settings.'
    )
  }

  if (status === 503 || status === 500 || msg.includes('503') || msg.includes('UNAVAILABLE')) {
    throw new Error(
      'Google Gemini is currently experiencing temporary high demand (503). Please wait a moment and try again.'
    )
  }

  throw new Error(`Google Gemini error: ${msg || 'Unknown failure'}`)
}

/**
 * Generates plain or HTML text content from Gemini using the user's decrypted personal API key.
 * Strictly uses the centralized Gemini Flash-Lite model (gemini-3.5-flash-lite) with no silent fallback.
 */
export async function generateTextContent(
  apiKey: string,
  prompt: string,
  systemInstruction: string = BASE_SYSTEM_PROMPT
): Promise<string> {
  const ai = getGeminiClient(apiKey)

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_CONFIG.MODEL_ID,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: GEMINI_CONFIG.TEMPERATURE_TEXT,
        },
      }),
      GEMINI_CONFIG.GENERATION_TIMEOUT_MS,
      `Gemini text generation timed out after ${GEMINI_CONFIG.GENERATION_TIMEOUT_MS / 1000}s`
    )

    const text = response?.text || ''
    return cleanCodeFences(text)
  } catch (err: any) {
    return handleGeminiError(err)
  }
}

/**
 * Generates and parses strongly typed JSON from Gemini using the user's decrypted personal API key.
 * Strictly uses the centralized Gemini Flash-Lite model (gemini-3.5-flash-lite) with no silent fallback.
 */
export async function generateStructuredJson<T>(
  apiKey: string,
  prompt: string,
  systemInstruction: string = BASE_SYSTEM_PROMPT
): Promise<T> {
  const ai = getGeminiClient(apiKey)

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: GEMINI_CONFIG.MODEL_ID,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: GEMINI_CONFIG.TEMPERATURE_JSON,
          responseMimeType: 'application/json',
        },
      }),
      GEMINI_CONFIG.GENERATION_TIMEOUT_MS,
      `Gemini structured generation timed out after ${GEMINI_CONFIG.GENERATION_TIMEOUT_MS / 1000}s`
    )

    const text = cleanCodeFences(response?.text || '{}')
    try {
      return JSON.parse(text) as T
    } catch (parseError) {
      console.error('[AI Service] Failed to parse JSON response:', text)
      throw new Error('Failed to parse AI output into structured data. Please try again.')
    }
  } catch (err: any) {
    return handleGeminiError(err)
  }
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
