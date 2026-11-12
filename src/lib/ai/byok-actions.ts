'use server'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenAI } from '@google/genai'
import { encryptApiKey, decryptApiKey } from './crypto'
import { GEMINI_CONFIG } from './config'

export interface UserAiClientConfig {
  ai_enabled: boolean
  is_configured: boolean
  provider: string
  key_hint: string | null
  last_validated_at: string | null
  consent_given: boolean
  consent_version: string
  preferred_model: string
  error?: string
}

const DEFAULT_CONFIG: UserAiClientConfig = {
  ai_enabled: false,
  is_configured: false,
  provider: GEMINI_CONFIG.PROVIDER,
  key_hint: null,
  last_validated_at: null,
  consent_given: false,
  consent_version: '1.0',
  preferred_model: GEMINI_CONFIG.DISPLAY_NAME,
}

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
 * Validates a Gemini API key against the centrally configured model (gemini-3.5-flash-lite).
 * Uses models.get() metadata query wrapped in a strict 12-second timeout deadline.
 * Completes in ~400ms without consuming generation quota or hanging in SDK retry loops.
 */
async function pingGeminiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const trimmed = apiKey.trim()
    if (!trimmed) {
      return { valid: false, error: 'API key cannot be empty.' }
    }

    const ai = new GoogleGenAI({ apiKey: trimmed })

    await withTimeout(
      ai.models.get({ model: GEMINI_CONFIG.MODEL_ID }),
      GEMINI_CONFIG.VALIDATION_TIMEOUT_MS,
      `Validation timed out after ${GEMINI_CONFIG.VALIDATION_TIMEOUT_MS / 1000} seconds. Google Gemini API did not respond. Please try again.`
    )

    return { valid: true }
  } catch (err: any) {
    const msg = err?.message || ''
    const status = err?.status || err?.statusCode || 0

    if (err?.name === 'TimeoutError' || msg.includes('timed out')) {
      return {
        valid: false,
        error: `Validation timed out after ${GEMINI_CONFIG.VALIDATION_TIMEOUT_MS / 1000} seconds. Google Gemini did not respond. Please try again.`,
      }
    }

    // If quota exceeded (429), the API key itself is authentic and verified
    if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      return { valid: true }
    }

    // Invalid authentication or unregistered key
    if (status === 400 || status === 403 || msg.includes('API_KEY_INVALID') || msg.includes('unregistered')) {
      return {
        valid: false,
        error: 'Invalid Google Gemini API key. Please verify your key on Google AI Studio and ensure it is active.',
      }
    }

    // Temporary upstream service unavailability
    if (status === 503 || status === 500 || msg.includes('503') || msg.includes('UNAVAILABLE')) {
      return {
        valid: false,
        error: 'Google Gemini service is temporarily experiencing high demand (503). Please wait a moment and try again.',
      }
    }

    return {
      valid: false,
      error: `Gemini verification failed: ${msg || 'Unknown network or service error'}`,
    }
  }
}

/**
 * Retrieves safe, client-facing AI metadata for the authenticated user.
 * Memoized per-request via React cache() to prevent duplicate database calls.
 * NEVER returns the encrypted or decrypted API key.
 */
export const getUserAiClientConfig = cache(async (): Promise<UserAiClientConfig> => {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return DEFAULT_CONFIG
    }

    const { data, error } = await supabase
      .from('user_ai_preferences')
      .select('ai_enabled, provider, key_hint, last_validated_at, consent_given, consent_version, encrypted_api_key, preferred_model')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      // Table may not exist yet in schema cache
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        return {
          ...DEFAULT_CONFIG,
          error: 'Database table public.user_ai_preferences is not created yet. Please apply migration 006 in your Supabase SQL editor.',
        }
      }
      return DEFAULT_CONFIG
    }

    if (!data) {
      return DEFAULT_CONFIG
    }

    const hasKey = Boolean(data.encrypted_api_key && data.key_hint)

    return {
      ai_enabled: hasKey ? Boolean(data.ai_enabled) : false,
      is_configured: hasKey,
      provider: GEMINI_CONFIG.PROVIDER,
      key_hint: data.key_hint || null,
      last_validated_at: data.last_validated_at || null,
      consent_given: Boolean(data.consent_given),
      consent_version: data.consent_version || '1.0',
      preferred_model: GEMINI_CONFIG.DISPLAY_NAME,
    }
  } catch (err: any) {
    console.error('[getUserAiClientConfig exception]:', err?.message)
    return DEFAULT_CONFIG
  }
})

/**
 * Validates and securely saves a student's personal Gemini API key.
 * Encrypts with AES-256-GCM before saving to Supabase.
 * Enforces key-replacement safety: preserves existing key if new key validation fails.
 */
export async function connectGeminiApiKey(
  apiKey: string
): Promise<{ success: boolean; error?: string; keyHint?: string; timingMs?: number }> {
  const tStart = Date.now()
  try {
    // 1. Session Authentication
    const t0Auth = Date.now()
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }
    const tAuth = Date.now() - t0Auth

    const trimmedKey = (apiKey || '').trim()
    if (!trimmedKey) {
      return { success: false, error: 'Please enter a valid Google Gemini API key.' }
    }

    // 2. Live Validation with Google Gemini API (<1s typical, 12s timeout)
    const t0Val = Date.now()
    const pingResult = await pingGeminiKey(trimmedKey)
    const tVal = Date.now() - t0Val

    if (!pingResult.valid) {
      // Existing key is strictly preserved because DB is NOT touched on failure
      return {
        success: false,
        error: pingResult.error || 'Failed to validate API key with Google Gemini.',
      }
    }

    // 3. Server-side AES-256-GCM Encryption with random 12-byte IV
    const t0Enc = Date.now()
    const encryptedPayload = encryptApiKey(trimmedKey)
    const tEnc = Date.now() - t0Enc

    // 4. Persist to Supabase
    const t0Db = Date.now()
    const nowIso = new Date().toISOString()
    const { error: upsertError } = await supabase.from('user_ai_preferences').upsert(
      {
        user_id: user.id,
        ai_enabled: true,
        provider: GEMINI_CONFIG.PROVIDER,
        encrypted_api_key: encryptedPayload.encryptedKey,
        encryption_iv: encryptedPayload.iv,
        encryption_auth_tag: encryptedPayload.authTag,
        encryption_version: encryptedPayload.version,
        key_hint: encryptedPayload.keyHint,
        consent_given: true,
        consent_version: '1.0',
        consented_at: nowIso,
        configured_at: nowIso,
        last_validated_at: nowIso,
        preferred_model: GEMINI_CONFIG.MODEL_ID,
        updated_at: nowIso,
      },
      { onConflict: 'user_id' }
    )
    const tDb = Date.now() - t0Db

    if (upsertError) {
      if (upsertError.message?.includes('schema cache') || upsertError.message?.includes('does not exist')) {
        return {
          success: false,
          error: 'Supabase table public.user_ai_preferences does not exist yet. Please run migration 006_secure_byok_ai_preferences.sql in Supabase SQL Editor.',
        }
      }
      return { success: false, error: upsertError.message }
    }

    const tTotal = Date.now() - tStart
    // Safe diagnostic log (Never logs API key or raw credentials)
    console.log(
      `[BYOK Connect] Success - User: ${user.id.slice(0, 8)}... | Auth: ${tAuth}ms | Validation: ${tVal}ms | Encrypt: ${tEnc}ms | DB: ${tDb}ms | Total: ${tTotal}ms`
    )

    revalidatePath('/dashboard/settings')
    return { success: true, keyHint: encryptedPayload.keyHint, timingMs: tTotal }
  } catch (err: any) {
    const tTotal = Date.now() - tStart
    console.error(`[BYOK Connect] Failed after ${tTotal}ms:`, err?.message)
    return { success: false, error: err?.message || 'Failed to securely store Gemini API key.' }
  }
}

/**
 * Tests the user's currently saved and encrypted Gemini API key.
 */
export async function testCurrentApiKey(): Promise<{ success: boolean; error?: string; timingMs?: number }> {
  const tStart = Date.now()
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized.' }
    }

    const { data, error } = await supabase
      .from('user_ai_preferences')
      .select('encrypted_api_key, encryption_iv, encryption_auth_tag')
      .eq('user_id', user.id)
      .single()

    if (error || !data || !data.encrypted_api_key) {
      return { success: false, error: 'No Gemini API key is currently connected.' }
    }

    // Decrypt key server-side
    const decryptedKey = decryptApiKey({
      encryptedKey: data.encrypted_api_key,
      iv: data.encryption_iv,
      authTag: data.encryption_auth_tag,
    })

    // Ping key against central model
    const ping = await pingGeminiKey(decryptedKey)
    if (!ping.valid) {
      return { success: false, error: ping.error }
    }

    // Update last_validated_at
    const nowIso = new Date().toISOString()
    await supabase
      .from('user_ai_preferences')
      .update({ last_validated_at: nowIso, updated_at: nowIso })
      .eq('user_id', user.id)

    const tTotal = Date.now() - tStart
    console.log(`[BYOK Test] Success - User: ${user.id.slice(0, 8)}... | Total: ${tTotal}ms`)

    revalidatePath('/dashboard/settings')
    return { success: true, timingMs: tTotal }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Test connection failed.' }
  }
}

/**
 * Disconnects the user's Gemini API key and wipes encryption metadata.
 */
export async function disconnectGeminiApiKey(): Promise<{ success: boolean; error?: string }> {
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
      .from('user_ai_preferences')
      .update({
        encrypted_api_key: null,
        encryption_iv: null,
        encryption_auth_tag: null,
        key_hint: null,
        ai_enabled: false,
        last_validated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to disconnect API key.' }
  }
}

/**
 * Enables or disables AI features for the current user.
 */
export async function toggleUserAiEnabled(
  enabled: boolean
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

    if (enabled) {
      // If enabling, verify a key is already configured
      const { data } = await supabase
        .from('user_ai_preferences')
        .select('encrypted_api_key')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!data || !data.encrypted_api_key) {
        return {
          success: false,
          error: 'Please connect a Gemini API key first before enabling AI features.',
        }
      }
    }

    const { error } = await supabase
      .from('user_ai_preferences')
      .update({
        ai_enabled: enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/settings')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update AI state.' }
  }
}

/**
 * Trusted internal server helper:
 * Retrieves and decrypts the authenticated user's personal Gemini API key.
 * Enforces that AI is enabled and fails securely without falling back to any shared key.
 */
export async function getDecryptedUserApiKey(userId: string): Promise<string> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('user_ai_preferences')
    .select('ai_enabled, encrypted_api_key, encryption_iv, encryption_auth_tag')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
      throw new Error(
        'AI preferences table is missing in Supabase. Please execute migration 006_secure_byok_ai_preferences.sql in your Supabase SQL Editor.'
      )
    }
    throw new Error(`Failed to load AI configuration: ${error.message}`)
  }

  if (!data || !data.encrypted_api_key) {
    throw new Error(
      'NO_API_KEY: No Google Gemini API key configured. Please add your personal Gemini API key in Settings -> AI Study Assistant & Privacy.'
    )
  }

  if (!data.ai_enabled) {
    throw new Error(
      'AI_DISABLED: AI capabilities are currently disabled in your Settings. Please enable them to use this feature.'
    )
  }

  try {
    return decryptApiKey({
      encryptedKey: data.encrypted_api_key,
      iv: data.encryption_iv,
      authTag: data.encryption_auth_tag,
    })
  } catch (decErr: any) {
    throw new Error('Failed to decrypt saved API credentials. Please reconnect your Gemini API key in Settings.')
  }
}
