'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getDecryptedUserApiKey } from '@/lib/ai/byok-actions'
import { generateStructuredJson } from '@/lib/ai/gemini'
import {
  getOverviewAssistantContext,
  buildOverviewAssistantSystemPrompt,
  OverviewGeminiOutput,
} from './overview-engine'
import {
  PlannerProposal,
  OverviewAssistantMessage,
} from '@/types/database'

export interface SendOverviewAssistantMessageParams {
  message: string
  clientHistory?: { role: 'user' | 'assistant'; content: string }[]
}

export interface SendOverviewAssistantMessageResult {
  success: boolean
  assistantMessage?: string
  proposal?: PlannerProposal | null
  suggestedFollowUps?: string[]
  error?: string
  errorCode?: 'NO_API_KEY' | 'AI_DISABLED' | 'AUTH_ERROR' | 'UNKNOWN'
}

/**
 * Server action: Fetches recent conversational messages for the authenticated student
 * on the Overview dashboard. Gracefully falls back if table migration is pending.
 */
export async function getOverviewChatHistoryAction(): Promise<{
  success: boolean
  messages: OverviewAssistantMessage[]
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
      .from('overview_assistant_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      // Graceful fallback if migration 009 has not been executed yet in Supabase
      console.warn('[Overview Assistant] Chat history lookup fallback:', error.message)
      return { success: true, messages: [] }
    }

    const parsedMessages: OverviewAssistantMessage[] = (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      role: row.role,
      content: row.content,
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
 * Server action: Processes a student question to Ask Study Companion.
 * 1. Authenticates student and decrypts their personal Gemini BYOK key.
 * 2. Compiles a fresh, deterministic study context from the database.
 * 3. Builds system prompt enforcing calculation truthfulness and actionable navigation.
 * 4. Calls Gemini Flash-Lite using single central model configuration.
 * 5. Persists interaction and returns structured response with interactive proposals.
 */
export async function sendOverviewAssistantMessageAction({
  message,
  clientHistory = [],
}: SendOverviewAssistantMessageParams): Promise<SendOverviewAssistantMessageResult> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Unauthorized. Please sign in to message Ask Study Companion.',
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
        error: msg || 'Unable to access your Gemini API key.',
        errorCode: 'UNKNOWN',
      }
    }

    // 2. Fetch fresh, verified study workspace context
    const context = await getOverviewAssistantContext(user.id)

    // 3. Build system instruction with real data
    const systemPrompt = buildOverviewAssistantSystemPrompt(context)

    // 4. Construct prompt with recent conversation history for multi-turn understanding
    const recentHistory = clientHistory.slice(-8)
    let conversationPrompt = ''

    if (recentHistory.length > 0) {
      conversationPrompt += '### RECENT CONVERSATION HISTORY:\n'
      for (const h of recentHistory) {
        conversationPrompt += `${h.role === 'user' ? 'Student' : 'Assistant'}: ${h.content}\n`
      }
      conversationPrompt += '\n'
    }

    conversationPrompt += `### CURRENT STUDENT QUESTION:\n${trimmedMsg}\n\nProvide your structured response matching the specified JSON schema.`

    // 5. Query Gemini Flash-Lite
    const aiOutput = await generateStructuredJson<OverviewGeminiOutput>(
      apiKey,
      conversationPrompt,
      systemPrompt
    )

    const assistantContent =
      aiOutput?.message ||
      'I have reviewed your study progress, but could not formulate a complete answer. Please rephrase or try another question.'

    let proposal: PlannerProposal | null = null
    if (aiOutput?.proposal && aiOutput.proposal.title) {
      proposal = {
        ...aiOutput.proposal,
        id: aiOutput.proposal.id || `prop-${Date.now()}`,
        status: 'pending',
      }
    }

    const suggestedFollowUps = aiOutput?.suggestedFollowUps || []

    // 6. Save messages to database (with graceful fallback if table not yet migrated)
    try {
      await supabase.from('overview_assistant_messages').insert([
        {
          user_id: user.id,
          role: 'user',
          content: trimmedMsg,
        },
        {
          user_id: user.id,
          role: 'assistant',
          content: assistantContent,
          proposal,
          suggested_follow_ups: suggestedFollowUps,
        },
      ])
    } catch (dbErr) {
      console.warn('[Overview Assistant] Message persistence bypassed:', dbErr)
    }

    return {
      success: true,
      assistantMessage: assistantContent,
      proposal,
      suggestedFollowUps,
    }
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'An error occurred while contacting Ask Study Companion.'
    console.error('[sendOverviewAssistantMessageAction Error]:', err)
    return {
      success: false,
      error: errorMsg,
      errorCode: 'UNKNOWN',
    }
  }
}

/**
 * Server action: Clears conversational chat history for a fresh start.
 */
export async function clearOverviewChatHistoryAction(): Promise<{
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
      .from('overview_assistant_messages')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.warn('[Overview Assistant] Clear history fallback:', error.message)
    }

    return { success: true }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error clearing history'
    return { success: false, error: errorMsg }
  }
}
