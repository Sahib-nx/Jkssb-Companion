'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getDecryptedUserApiKey } from '@/lib/ai/byok-actions'
import { generateStructuredJson } from '@/lib/ai/gemini'
import {
  getAnalyticsAssistantContext,
  buildAnalyticsAssistantSystemPrompt,
  AnalyticsGeminiOutput,
} from './analytics-engine'
import {
  PlannerProposal,
  AnalyticsAssistantMessage,
  AnalyticsInsightItem,
} from '@/types/database'

export interface SendAnalyticsAssistantMessageParams {
  message: string
  clientHistory?: { role: 'user' | 'assistant'; content: string }[]
}

export interface SendAnalyticsAssistantMessageResult {
  success: boolean
  assistantMessage?: string
  insights?: AnalyticsInsightItem[]
  proposal?: PlannerProposal | null
  suggestedFollowUps?: string[]
  error?: string
  errorCode?: 'NO_API_KEY' | 'AI_DISABLED' | 'AUTH_ERROR' | 'UNKNOWN'
}

/**
 * Server action: Fetches conversational messages for the authenticated student
 * on the Analytics page. Gracefully falls back if table migration is pending.
 */
export async function getAnalyticsChatHistoryAction(): Promise<{
  success: boolean
  messages: AnalyticsAssistantMessage[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, messages: [], error: 'Unauthorized.' }
    }

    const { data, error } = await supabase
      .from('analytics_assistant_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      // Graceful fallback if migration 010 has not been executed yet in Supabase
      console.warn('[Analytics Assistant] Chat history lookup fallback:', error.message)
      return { success: true, messages: [] }
    }

    const parsedMessages: AnalyticsAssistantMessage[] = (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      role: row.role,
      content: row.content,
      insights: row.insights || undefined,
      proposal: row.proposal || null,
      suggestedFollowUps: row.suggested_follow_ups || undefined,
      created_at: row.created_at,
    }))

    return {
      success: true,
      messages: parsedMessages,
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching messages'
    return { success: false, messages: [], error: errorMsg }
  }
}

/**
 * Server action: Fetches deterministic diagnostic badges without invoking Gemini.
 * Zero AI API cost, instant load time.
 */
export async function getDeterministicAnalyticsInsightsAction(): Promise<{
  success: boolean
  insights: AnalyticsInsightItem[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, insights: [], error: 'Unauthorized' }
    }

    const context = await getAnalyticsAssistantContext(user.id)
    return {
      success: true,
      insights: context.deterministicInsights,
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error computing insights'
    return { success: false, insights: [], error: errorMsg }
  }
}

/**
 * Server action: Processes a student's analytics query.
 * 1. Authenticates student and decrypts their personal Gemini BYOK key.
 * 2. Compiles a fresh, deterministic study context from the database.
 * 3. Builds system prompt enforcing numerical truthfulness, genuine trend detection, and lack of stopwatch fabrication.
 * 4. Calls Gemini Flash-Lite using single central model configuration.
 * 5. Persists interaction and returns structured response.
 */
export async function sendAnalyticsAssistantMessageAction({
  message,
  clientHistory = [],
}: SendAnalyticsAssistantMessageParams): Promise<SendAnalyticsAssistantMessageResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Unauthorized. Please sign in to message AI Analytics Assistant.',
        errorCode: 'AUTH_ERROR',
      }
    }

    const trimmedMsg = message?.trim()
    if (!trimmedMsg) {
      return {
        success: false,
        error: 'Please enter a question or select a prompt suggestion.',
        errorCode: 'UNKNOWN',
      }
    }

    // 1. Decrypt user's Gemini BYOK API Key
    let apiKey: string
    try {
      apiKey = await getDecryptedUserApiKey(user.id)
    } catch (keyErr: any) {
      const msg = keyErr?.message || ''
      if (msg.includes('NO_API_KEY')) {
        return {
          success: false,
          error:
            'Google Gemini API Key required. Please connect your free Gemini API key in Settings > AI Study Assistant & Privacy.',
          errorCode: 'NO_API_KEY',
        }
      }
      if (msg.includes('AI_DISABLED')) {
        return {
          success: false,
          error:
            'AI capabilities are currently disabled. Please enable AI in Settings > AI Study Assistant & Privacy.',
          errorCode: 'AI_DISABLED',
        }
      }
      return {
        success: false,
        error: keyErr?.message || 'Failed to authenticate AI configuration.',
        errorCode: 'UNKNOWN',
      }
    }

    // 2. Fetch fresh, strictly computed analytics context
    const context = await getAnalyticsAssistantContext(user.id)

    // 3. Build system instruction
    const systemPrompt = buildAnalyticsAssistantSystemPrompt(context)

    // Format conversation history for context
    const recentHistory = clientHistory.slice(-6)
    let promptText = ''
    if (recentHistory.length > 0) {
      promptText += 'CONVERSATION HISTORY:\n'
      for (const h of recentHistory) {
        promptText += `${h.role === 'user' ? 'Student' : 'Analytics Assistant'}: ${h.content}\n`
      }
      promptText += '\n'
    }
    promptText += `Student: ${trimmedMsg}\n\nRespond as the AI Analytics Assistant with JSON following the required schema.`

    // 4. Call Gemini Flash-Lite
    const result = await generateStructuredJson<AnalyticsGeminiOutput>(
      apiKey,
      promptText,
      systemPrompt
    )

    if (!result || !result.message) {
      throw new Error('Received an empty response from AI service.')
    }

    // 5. Persist interaction in database (gracefully catch if table is awaiting migration)
    try {
      await supabase.from('analytics_assistant_messages').insert([
        {
          user_id: user.id,
          role: 'user',
          content: trimmedMsg,
        },
        {
          user_id: user.id,
          role: 'assistant',
          content: result.message,
          insights: result.insights || null,
          proposal: result.proposal || null,
          suggested_follow_ups: result.suggestedFollowUps || null,
        },
      ])
    } catch (insertErr: any) {
      console.warn('[Analytics Assistant] Non-critical persistence warning:', insertErr.message)
    }

    return {
      success: true,
      assistantMessage: result.message,
      insights: result.insights || context.deterministicInsights,
      proposal: result.proposal || null,
      suggestedFollowUps: result.suggestedFollowUps || [
        'How can I improve my revision consistency?',
        'Which subject needs more attention?',
        'Can I finish my syllabus before my target date?',
      ],
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.'
    console.error('[sendAnalyticsAssistantMessageAction] Error:', err)
    return {
      success: false,
      error: errorMsg,
      errorCode: 'UNKNOWN',
    }
  }
}

/**
 * Server action: Clears conversational chat history for the student on the Analytics page.
 */
export async function clearAnalyticsChatHistoryAction(): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized.' }
    }

    const { error } = await supabase
      .from('analytics_assistant_messages')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.warn('[clearAnalyticsChatHistoryAction] Clear error:', error.message)
    }

    revalidatePath('/dashboard/analytics')
    return { success: true }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to clear chat history.'
    return { success: false, error: errorMsg }
  }
}
