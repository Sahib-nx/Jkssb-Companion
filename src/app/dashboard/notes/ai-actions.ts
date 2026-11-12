'use server'

import { createClient } from '@/lib/supabase/server'
import { aiRateLimiter } from '@/lib/ai/rate-limiter'
import { generateTextContent } from '@/lib/ai/gemini'
import { getNotesAssistantPrompt, NotesOperation, BASE_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { getDecryptedUserApiKey } from '@/lib/ai/byok-actions'

export interface ProcessNotesResult {
  success: boolean
  transformedContent?: string
  operation?: NotesOperation
  error?: string
  errorCode?: 'NO_API_KEY' | 'AI_DISABLED' | 'RATE_LIMIT' | 'AUTH_ERROR' | 'UNKNOWN'
}

/**
 * Server action to process notes via Gemini AI Assistant using the authenticated user's BYOK key.
 */
export async function processNotesWithAI(
  operation: NotesOperation,
  noteText: string,
  isSelectionOnly: boolean = false
): Promise<ProcessNotesResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Unauthorized. Please sign in to use AI features.',
        errorCode: 'AUTH_ERROR',
      }
    }

    // Retrieve user's decrypted Gemini API key (enforces that AI is enabled & configured)
    let userApiKey: string
    try {
      userApiKey = await getDecryptedUserApiKey(user.id)
    } catch (keyErr: any) {
      const msg = keyErr?.message || ''
      if (msg.includes('NO_API_KEY')) {
        return {
          success: false,
          error: 'No Gemini API key connected. Please connect your personal Google Gemini API key in Settings.',
          errorCode: 'NO_API_KEY',
        }
      }
      if (msg.includes('AI_DISABLED')) {
        return {
          success: false,
          error: 'AI features are disabled in Settings. Please enable them to use the assistant.',
          errorCode: 'AI_DISABLED',
        }
      }
      return {
        success: false,
        error: msg || 'AI configuration error. Please check your Settings.',
        errorCode: 'UNKNOWN',
      }
    }

    // Check rate limit
    const rateCheck = aiRateLimiter.checkLimit(user.id)
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Rate limit reached. Please wait ${rateCheck.retryAfterSeconds} seconds before making another AI request.`,
        errorCode: 'RATE_LIMIT',
      }
    }

    // Validate note content
    const trimmed = (noteText || '').trim()
    if (!trimmed || trimmed.length < 10) {
      return {
        success: false,
        error: 'The note has insufficient content. Please write or paste some notes first before running the AI assistant.',
      }
    }

    // Build prompt & generate using the user's personal BYOK key
    const prompt = getNotesAssistantPrompt(operation, trimmed, isSelectionOnly)
    const result = await generateTextContent(userApiKey, prompt, BASE_SYSTEM_PROMPT)

    if (!result) {
      return {
        success: false,
        error: 'AI returned an empty response. Please try again or rephrase your notes.',
      }
    }

    return {
      success: true,
      transformedContent: result,
      operation,
    }
  } catch (err: any) {
    console.error('[AI Notes Action Error]:', err)
    const message = err?.message || 'Failed to process notes with AI. Please check your connection.'
    return {
      success: false,
      error: message,
    }
  }
}
