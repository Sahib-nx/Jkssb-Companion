'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { RevisionMode } from '@/types/database'

export async function createRevisionSession({
  title,
  subjectId,
  mode,
  lectureIds,
  scheduledDate,
  description,
}: {
  title: string
  subjectId?: string | null
  mode: RevisionMode
  lectureIds: string[]
  scheduledDate?: string | null
  description?: string | null
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    if (!lectureIds || lectureIds.length === 0) {
      return { success: false, error: 'At least one lecture must be selected for revision.' }
    }

    const cleanTitle = title.trim() || 'Revision Session'
    const cleanSubjectId = subjectId && subjectId.trim() !== '' ? subjectId : null
    const cleanScheduledDate = scheduledDate && scheduledDate.trim() !== '' ? scheduledDate : null
    const isScheduledFuture = Boolean(
      cleanScheduledDate && cleanScheduledDate > new Date().toISOString().slice(0, 10)
    )

    // 1. Create revision session
    const { data: session, error: sessionErr } = await supabase
      .from('revision_sessions')
      .insert({
        user_id: user.id,
        title: cleanTitle,
        subject_id: cleanSubjectId,
        mode,
        scheduled_date: cleanScheduledDate,
        status: isScheduledFuture ? 'scheduled' : 'in_progress',
        description: description?.trim() || null,
      })
      .select('id')
      .single()

    if (sessionErr || !session) {
      return { success: false, error: sessionErr?.message || 'Failed to create revision session' }
    }

    // 2. Associate lectures in session
    const sessionLectures = lectureIds.map((lecId, idx) => ({
      session_id: session.id,
      lecture_id: lecId,
      order_index: idx,
      is_revised: false,
      is_difficult: false,
      needs_re_revision: false,
    }))

    const { error: lecErr } = await supabase
      .from('revision_session_lectures')
      .insert(sessionLectures)

    if (lecErr) {
      return { success: false, error: lecErr.message }
    }

    revalidatePath('/dashboard/revision')
    return { success: true, sessionId: session.id }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create revision session'
    return { success: false, error: message }
  }
}

export async function recordLectureRevision({
  sessionId,
  lectureId,
  isDifficult,
  needsReRevision,
  nextRevisionDate,
}: {
  sessionId: string
  lectureId: string
  isDifficult: boolean
  needsReRevision: boolean
  nextRevisionDate?: string | null
}): Promise<{ success: boolean; allCompleted?: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const nowIso = new Date().toISOString()
    const cleanNextDate = nextRevisionDate && nextRevisionDate.trim() !== '' ? nextRevisionDate : null

    // 1. Update the lecture state within the revision session
    const { error: updateLecErr } = await supabase
      .from('revision_session_lectures')
      .update({
        is_revised: true,
        is_difficult: isDifficult,
        needs_re_revision: needsReRevision,
        revised_at: nowIso,
      })
      .eq('session_id', sessionId)
      .eq('lecture_id', lectureId)

    if (updateLecErr) {
      return { success: false, error: updateLecErr.message }
    }

    // 2. Insert into revision_history
    const { error: histErr } = await supabase
      .from('revision_history')
      .insert({
        user_id: user.id,
        lecture_id: lectureId,
        session_id: sessionId,
        revised_at: nowIso,
        is_difficult: isDifficult,
        needs_re_revision: needsReRevision,
        next_revision_date: cleanNextDate,
      })

    if (histErr) {
      return { success: false, error: histErr.message }
    }

    // 3. Check if all lectures in this session are revised
    const { data: sessionLectures } = await supabase
      .from('revision_session_lectures')
      .select('is_revised')
      .eq('session_id', sessionId)

    const allCompleted = sessionLectures?.every((l) => l.is_revised) ?? false

    if (allCompleted) {
      await supabase
        .from('revision_sessions')
        .update({
          status: 'completed',
          updated_at: nowIso,
        })
        .eq('id', sessionId)
        .eq('user_id', user.id)
    }

    revalidatePath(`/dashboard/revision/workspace/${sessionId}`)
    revalidatePath('/dashboard/revision')
    return { success: true, allCompleted }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to record revision'
    return { success: false, error: message }
  }
}

export async function deleteRevisionSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const { error: delErr } = await supabase
      .from('revision_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id)

    if (delErr) {
      return { success: false, error: delErr.message }
    }

    revalidatePath('/dashboard/revision')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete revision session'
    return { success: false, error: message }
  }
}
