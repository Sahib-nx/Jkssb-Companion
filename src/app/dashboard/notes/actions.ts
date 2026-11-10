'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Json } from '@/types/database'

// --- LECTURE NOTES ACTIONS ---

export async function saveLectureNote(
  lectureId: string,
  content: Json,
  plainText: string
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

    if (!lectureId) {
      return { success: false, error: 'Invalid lecture ID.' }
    }

    // Upsert note for this user and lecture
    const { error: upsertError } = await supabase
      .from('lecture_notes')
      .upsert(
        {
          user_id: user.id,
          lecture_id: lectureId,
          content,
          plain_text: plainText,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,lecture_id',
        }
      )

    if (upsertError) {
      return { success: false, error: upsertError.message }
    }

    revalidatePath(`/dashboard/lectures/${lectureId}`)
    revalidatePath('/dashboard/lecture-notes')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save note'
    return { success: false, error: message }
  }
}

export async function deleteLectureNote(
  lectureId: string
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

    const { error: deleteError } = await supabase
      .from('lecture_notes')
      .delete()
      .eq('user_id', user.id)
      .eq('lecture_id', lectureId)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    revalidatePath(`/dashboard/lectures/${lectureId}`)
    revalidatePath('/dashboard/lecture-notes')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete note'
    return { success: false, error: message }
  }
}

// --- GENERAL NOTES ACTIONS ---

export async function saveGeneralNote(
  noteId: string | null,
  title: string,
  subjectId: string | null,
  content: Json,
  plainText: string
): Promise<{ success: boolean; noteId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const cleanTitle = title.trim() || 'Untitled Note'
    const cleanSubjectId = subjectId && subjectId.trim() !== '' ? subjectId : null

    if (noteId) {
      // Update existing note with strict user ownership check
      const { error: updateError } = await supabase
        .from('general_notes')
        .update({
          title: cleanTitle,
          subject_id: cleanSubjectId,
          content,
          plain_text: plainText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)
        .eq('user_id', user.id)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      revalidatePath('/dashboard/general-notes')
      revalidatePath(`/dashboard/general-notes/${noteId}`)
      return { success: true, noteId }
    } else {
      // Create new note
      const { data: newNote, error: insertError } = await supabase
        .from('general_notes')
        .insert({
          user_id: user.id,
          title: cleanTitle,
          subject_id: cleanSubjectId,
          content,
          plain_text: plainText,
        })
        .select('id')
        .single()

      if (insertError || !newNote) {
        return { success: false, error: insertError?.message || 'Failed to create note' }
      }

      revalidatePath('/dashboard/general-notes')
      return { success: true, noteId: newNote.id }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save note'
    return { success: false, error: message }
  }
}

export async function deleteGeneralNote(
  noteId: string
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

    const { error: deleteError } = await supabase
      .from('general_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', user.id)

    if (deleteError) {
      return { success: false, error: deleteError.message }
    }

    revalidatePath('/dashboard/general-notes')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete general note'
    return { success: false, error: message }
  }
}
