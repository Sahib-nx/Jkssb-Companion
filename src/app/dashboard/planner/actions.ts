'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { TaskStatus } from '@/types/database'

export async function createStudyTask({
  title,
  subjectId,
  scheduledDate,
  description,
}: {
  title: string
  subjectId?: string | null
  scheduledDate: string
  description?: string | null
}): Promise<{ success: boolean; taskId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const cleanTitle = title.trim()
    if (!cleanTitle) {
      return { success: false, error: 'Task title is required.' }
    }

    const cleanDate = scheduledDate?.trim() || new Date().toISOString().slice(0, 10)
    const cleanSubjectId = subjectId && subjectId.trim() !== '' ? subjectId : null

    const { data: task, error: insertErr } = await supabase
      .from('study_tasks')
      .insert({
        user_id: user.id,
        title: cleanTitle,
        subject_id: cleanSubjectId,
        scheduled_date: cleanDate,
        description: description?.trim() || null,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertErr || !task) {
      return { success: false, error: insertErr?.message || 'Failed to create study task' }
    }

    revalidatePath('/dashboard/planner')
    return { success: true, taskId: task.id }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create task'
    return { success: false, error: message }
  }
}

export async function updateStudyTask({
  taskId,
  title,
  subjectId,
  scheduledDate,
  description,
}: {
  taskId: string
  title: string
  subjectId?: string | null
  scheduledDate: string
  description?: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const cleanTitle = title.trim()
    if (!cleanTitle) {
      return { success: false, error: 'Task title is required.' }
    }

    const cleanDate = scheduledDate?.trim() || new Date().toISOString().slice(0, 10)
    const cleanSubjectId = subjectId && subjectId.trim() !== '' ? subjectId : null

    const { error: updateErr } = await supabase
      .from('study_tasks')
      .update({
        title: cleanTitle,
        subject_id: cleanSubjectId,
        scheduled_date: cleanDate,
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    revalidatePath('/dashboard/planner')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update task'
    return { success: false, error: message }
  }
}

export async function toggleTaskStatus(
  taskId: string,
  currentStatus: TaskStatus
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

    const newStatus: TaskStatus = currentStatus === 'completed' ? 'pending' : 'completed'
    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null

    const { error: updateErr } = await supabase
      .from('study_tasks')
      .update({
        status: newStatus,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    revalidatePath('/dashboard/planner')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to toggle task status'
    return { success: false, error: message }
  }
}

export async function deleteStudyTask(
  taskId: string
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
      .from('study_tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (delErr) {
      return { success: false, error: delErr.message }
    }

    revalidatePath('/dashboard/planner')
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete task'
    return { success: false, error: message }
  }
}
