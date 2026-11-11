'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface UserAiPreferences {
  consent_given: boolean
  consent_version: string
  consented_at: string | null
  ai_enabled: boolean
  preferred_model: string
}

const DEFAULT_PREFERENCES: UserAiPreferences = {
  consent_given: false,
  consent_version: '1.0',
  consented_at: null,
  ai_enabled: true,
  preferred_model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
}

/**
 * Retrieves the current user's AI preferences and consent status.
 */
export async function getUserAiPreferences(): Promise<UserAiPreferences> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return DEFAULT_PREFERENCES
    }

    const { data, error } = await supabase
      .from('user_ai_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !data) {
      return DEFAULT_PREFERENCES
    }

    return {
      consent_given: !!data.consent_given,
      consent_version: data.consent_version || '1.0',
      consented_at: data.consented_at,
      ai_enabled: data.ai_enabled ?? true,
      preferred_model: data.preferred_model || (process.env.GEMINI_MODEL || 'gemini-2.5-flash'),
    }
  } catch (err) {
    console.warn('[AI Preferences] Error fetching preferences, using defaults:', err)
    return DEFAULT_PREFERENCES
  }
}

/**
 * Records explicit user consent to use AI features.
 */
export async function recordUserAiConsent(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabase.from('user_ai_preferences').upsert(
      {
        user_id: user.id,
        consent_given: true,
        consent_version: '1.0',
        consented_at: new Date().toISOString(),
        ai_enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.warn('[AI Consent] Could not persist to DB (table may not exist yet):', error.message)
    }

    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch (err: any) {
    return { success: true } // Graceful fallback
  }
}

/**
 * Updates AI enabled status or revokes consent from Settings.
 */
export async function updateAiSettings(payload: {
  ai_enabled?: boolean
  revoke_consent?: boolean
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const updateData: any = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }

    if (typeof payload.ai_enabled === 'boolean') {
      updateData.ai_enabled = payload.ai_enabled
    }

    if (payload.revoke_consent) {
      updateData.consent_given = false
      updateData.consented_at = null
    }

    const { error } = await supabase
      .from('user_ai_preferences')
      .upsert(updateData, { onConflict: 'user_id' })

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update AI settings' }
  }
}
