/**
 * Centralized Gemini AI Configuration
 *
 * Strict Single-Model Policy:
 * The application centrally standardizes on Google Gemini 3.5 Flash Lite ('gemini-3.5-flash-lite').
 * No model dropdowns, no student selection, no silent fallbacks, and no alternate providers.
 */
export const GEMINI_CONFIG = {
  // Official Google GenAI API Model ID
  MODEL_ID: 'gemini-3.5-flash-lite',
  // User-facing display name
  DISPLAY_NAME: 'Gemini 3.5 Flash Lite',
  // Provider name
  PROVIDER: 'gemini' as const,
  // Hard server-side timeout for API key validation (in milliseconds)
  VALIDATION_TIMEOUT_MS: 12000, // 12 seconds
  // Hard server-side timeout for AI content generation (in milliseconds)
  GENERATION_TIMEOUT_MS: 30000, // 30 seconds
  // Sampling temperatures
  TEMPERATURE_TEXT: 0.3,
  TEMPERATURE_JSON: 0.2,
} as const
