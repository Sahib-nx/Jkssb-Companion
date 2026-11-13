'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getDecryptedUserApiKey } from '@/lib/ai/byok-actions'
import { generateStructuredJson } from '@/lib/ai/gemini'
import { BASE_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import {
  getPlannerAssistantContext,
  buildPlannerAssistantSystemPrompt,
  executeApprovedProposal,
  AssistantGeminiOutput,
} from './assistant-engine'
import {
  PlannerProposal,
  PlannerAssistantMessage,
} from '@/types/database'

/**
 * Server action: Fetches recent conversational messages for the authenticated student.
 */
export async function getPlannerChatHistoryAction(): Promise<{
  success: boolean
  messages: PlannerAssistantMessage[]
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
      .from('planner_assistant_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      // If table does not exist yet or other query error, gracefully return empty list
      console.warn('[Planner Assistant] Chat history lookup failed:', error.message)
      return { success: true, messages: [] }
    }

    return {
      success: true,
      messages: (data || []) as PlannerAssistantMessage[],
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error fetching messages'
    return { success: false, messages: [], error: errorMsg }
  }
}

/**
 * Server action: Sends a student's message to the AI Study Assistant.
 * Validates BYOK key, injects real student context, calls Gemini 3.5 Flash Lite,
 * and saves conversation history and proposals.
 */
export async function sendPlannerAssistantMessageAction({
  message,
}: {
  message: string
}): Promise<{
  success: boolean
  assistantMessage?: string
  proposal?: PlannerProposal | null
  error?: string
  errorCode?: 'NO_API_KEY' | 'AI_DISABLED' | 'AUTH_ERROR' | 'UNKNOWN'
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Unauthorized. Please sign in to message the AI Study Assistant.',
        errorCode: 'AUTH_ERROR',
      }
    }

    const cleanMessage = (message || '').trim()
    if (!cleanMessage) {
      return { success: false, error: 'Please enter a message.' }
    }

    // 1. Verify and decrypt student's personal Gemini API key (BYOK)
    let userApiKey: string
    try {
      userApiKey = await getDecryptedUserApiKey(user.id)
    } catch (keyErr: unknown) {
      const msg = keyErr instanceof Error ? keyErr.message : String(keyErr)
      if (msg.includes('NO_API_KEY')) {
        return {
          success: false,
          error:
            'No Gemini API key connected. Please connect your personal Google Gemini API key in Settings -> AI Study Assistant.',
          errorCode: 'NO_API_KEY',
        }
      }
      if (msg.includes('AI_DISABLED')) {
        return {
          success: false,
          error:
            'AI capabilities are currently disabled in Settings. Please enable them to use the AI Study Assistant.',
          errorCode: 'AI_DISABLED',
        }
      }
      return {
        success: false,
        error: msg || 'AI configuration error. Please check your Settings.',
        errorCode: 'UNKNOWN',
      }
    }

    // 2. Fetch real student context in parallel (<200ms)
    const context = await getPlannerAssistantContext(user.id)

    // 3. Construct system prompt with real context
    const systemPrompt = buildPlannerAssistantSystemPrompt(context)

    // 4. Save user message to database
    try {
      await supabase.from('planner_assistant_messages').insert({
        user_id: user.id,
        role: 'user',
        content: cleanMessage,
      })
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
      console.warn('[Planner Assistant] Non-fatal error persisting user message:', msg)
    }

    // 5. Query Gemini 3.5 Flash Lite
    let result: AssistantGeminiOutput
    try {
      result = await generateStructuredJson<AssistantGeminiOutput>(
        userApiKey,
        cleanMessage,
        `${BASE_SYSTEM_PROMPT}\n\n${systemPrompt}`
      )
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr)
      console.error('[Planner Assistant] Gemini generation error:', msg)
      return {
        success: false,
        error:
          'Failed to receive a response from Gemini. Please check your Gemini API key or try again in a few moments.',
        errorCode: 'UNKNOWN',
      }
    }

    // Ensure proposal has proper ID and pending status if present
    let finalProposal: PlannerProposal | null = null
    if (result.proposal) {
      finalProposal = {
        ...result.proposal,
        id: result.proposal.id || `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        status: 'pending',
      }
    }

    // 6. Save assistant message and proposal to database
    try {
      await supabase.from('planner_assistant_messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: result.message,
        proposal: finalProposal,
      })
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
      console.warn('[Planner Assistant] Non-fatal error persisting assistant message:', msg)
    }

    return {
      success: true,
      assistantMessage: result.message,
      proposal: finalProposal,
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred while communicating with the assistant.'
    return {
      success: false,
      error: errorMsg,
    }
  }
}

/**
 * Server action: Confirms and applies a proposed schedule modification.
 * Re-validates ownership, executes updates on study_tasks and roadmaps, and marks proposal applied.
 */
export async function applyPlannerProposalAction(
  proposal: PlannerProposal
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized.' }
    }

    if (!proposal || !proposal.id) {
      return { success: false, error: 'Invalid proposal.' }
    }

    // Execute proposal with strict validation
    const result = await executeApprovedProposal(user.id, proposal)
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to apply schedule changes.' }
    }

    // Revalidate dashboard planner so all tabs reflect updated schedule
    revalidatePath('/dashboard/planner')

    return {
      success: true,
      message: 'Schedule changes successfully applied to your study planner!',
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to apply changes.'
    return { success: false, error: errorMsg }
  }
}

/**
 * Server action: Cancels a proposed schedule modification.
 * Leaves all study tasks and database records 100% untouched.
 */
export async function cancelPlannerProposalAction(
  proposalId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized.' }
    }

    // Mark proposal status as cancelled in recent messages
    const { data: messages } = await supabase
      .from('planner_assistant_messages')
      .select('id, proposal')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (messages) {
      for (const msg of messages) {
        if (msg.proposal && (msg.proposal.id === proposalId || msg.proposal.title)) {
          const updatedProposal = { ...msg.proposal, status: 'cancelled' }
          await supabase
            .from('planner_assistant_messages')
            .update({ proposal: updatedProposal })
            .eq('id', msg.id)
          break
        }
      }
    }

    return { success: true }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error cancelling proposal'
    return { success: false, error: errorMsg }
  }
}

/**
 * Server action: Clears conversational chat history for a fresh start.
 */
export async function clearPlannerChatHistoryAction(): Promise<{
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
      .from('planner_assistant_messages')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error clearing history'
    return { success: false, error: errorMsg }
  }
}
