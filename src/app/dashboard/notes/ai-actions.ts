'use server'

import { createClient } from '@/lib/supabase/server'
import { aiRateLimiter } from '@/lib/ai/rate-limiter'
import { generateTextContent } from '@/lib/ai/gemini'
import { getNotesAssistantPrompt, NotesOperation, BASE_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { getUserAiPreferences } from '@/lib/ai/consent-actions'

export interface ProcessNotesResult {
  success: boolean
  transformedContent?: string
  operation?: NotesOperation
  error?: string
}

/**
 * Server action to process notes via Gemini AI Assistant
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
      return { success: false, error: 'Unauthorized. Please sign in to use AI features.' }
    }

    // Check user AI preferences
    const preferences = await getUserAiPreferences()
    if (!preferences.ai_enabled) {
      return {
        success: false,
        error: 'AI features are currently disabled in your Settings. Enable them to use the assistant.',
      }
    }

    // Check rate limit
    const rateCheck = aiRateLimiter.checkLimit(user.id)
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Rate limit reached. Please wait ${rateCheck.retryAfterSeconds} seconds before making another AI request.`,
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

    // Build prompt & generate
    const prompt = getNotesAssistantPrompt(operation, trimmed, isSelectionOnly)
    const result = await generateTextContent(prompt, BASE_SYSTEM_PROMPT)

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
