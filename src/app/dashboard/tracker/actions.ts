'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type TargetStatus = 'not_started' | 'in_progress' | 'completed'

export async function updateLectureProgress(
  lectureId: string,
  targetStatus: TargetStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Securely derive user from server session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    if (!lectureId) {
      return { success: false, error: 'Invalid lecture ID.' }
    }

    // Check existing progress record for this user and lecture
    const { data: existing, error: fetchError } = await supabase
      .from('lecture_progress')
      .select('id, started_at, completed_at, status')
      .eq('user_id', user.id)
      .eq('lecture_id', lectureId)
      .maybeSingle()

    if (fetchError) {
      return { success: false, error: fetchError.message }
    }

    const nowIso = new Date().toISOString()

    if (targetStatus === 'not_started') {
      // In this schema, a missing progress record represents Not Started
      if (existing) {
        const { error: deleteError } = await supabase
          .from('lecture_progress')
          .delete()
          .eq('id', existing.id)
          .eq('user_id', user.id) // strict ownership safety

        if (deleteError) {
          return { success: false, error: deleteError.message }
        }
      }
    } else if (targetStatus === 'in_progress') {
      if (existing) {
        // Preserve original started_at, clear completed_at
        const { error: updateError } = await supabase
          .from('lecture_progress')
          .update({
            status: 'in_progress',
            completed_at: null,
            // started_at is preserved
          })
          .eq('id', existing.id)
          .eq('user_id', user.id)

        if (updateError) {
          return { success: false, error: updateError.message }
        }
      } else {
        // Create new progress record
        const { error: insertError } = await supabase
          .from('lecture_progress')
          .insert({
            user_id: user.id,
            lecture_id: lectureId,
            status: 'in_progress',
            started_at: nowIso,
            completed_at: null,
          })

        if (insertError) {
          return { success: false, error: insertError.message }
        }
      }
    } else if (targetStatus === 'completed') {
      if (existing) {
        // Preserve original started_at, update completed_at
        const { error: updateError } = await supabase
          .from('lecture_progress')
          .update({
            status: 'completed',
            completed_at: nowIso,
            // started_at is preserved
          })
          .eq('id', existing.id)
          .eq('user_id', user.id)

        if (updateError) {
          return { success: false, error: updateError.message }
        }
      } else {
        // If completing directly without prior in_progress, set started_at and completed_at
        const { error: insertError } = await supabase
          .from('lecture_progress')
          .insert({
            user_id: user.id,
            lecture_id: lectureId,
            status: 'completed',
            started_at: nowIso,
            completed_at: nowIso,
          })

        if (insertError) {
          return { success: false, error: insertError.message }
        }
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/tracker')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return { success: false, error: message }
  }
}
