'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface InitialSubjectInput {
  name: string
  lectureCount: number
  color?: string
}

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return base || 'subject'
}

/**
 * Checks whether the authenticated user has any active subjects configured.
 */
export async function checkUserWorkspace(): Promise<{
  hasWorkspace: boolean
  subjectCount: number
  userId?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { hasWorkspace: false, subjectCount: 0 }
    }

    const { count, error } = await supabase
      .from('subjects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_archived', false)

    if (error) {
      console.error('[checkUserWorkspace error]:', error.message)
      return { hasWorkspace: false, subjectCount: 0, userId: user.id }
    }

    const subjectCount = count || 0
    return {
      hasWorkspace: subjectCount > 0,
      subjectCount,
      userId: user.id,
    }
  } catch (err: unknown) {
    console.error('[checkUserWorkspace exception]:', err)
    return { hasWorkspace: false, subjectCount: 0 }
  }
}

/**
 * Creates the user's initial dynamic workspace with subjects and batch-generated lectures.
 */
export async function createWorkspace(
  subjects: InitialSubjectInput[]
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

    if (!subjects || subjects.length === 0) {
      return { success: false, error: 'Please add at least one subject to set up your workspace.' }
    }

    // Check for accidental duplicate workspace creation
    const { count: existingCount } = await supabase
      .from('subjects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_archived', false)

    if (existingCount && existingCount > 0) {
      return {
        success: false,
        error: 'You already have an active workspace configured.',
      }
    }

    // Default colors for visual variety if not provided
    const defaultColors = [
      '#3B82F6', // Blue
      '#10B981', // Emerald
      '#8B5CF6', // Purple
      '#F59E0B', // Amber
      '#06B6D4', // Cyan
      '#EC4899', // Pink
      '#6366F1', // Indigo
      '#14B8A6', // Teal
    ]

    const usedSlugs = new Set<string>()

    for (let sIdx = 0; sIdx < subjects.length; sIdx++) {
      const item = subjects[sIdx]
      const trimmedName = item.name.trim()
      const lectureCount = Math.max(1, Math.min(500, Math.floor(Number(item.lectureCount) || 1)))

      if (!trimmedName) {
        continue
      }

      // Generate unique slug per user
      let slug = generateSlug(trimmedName)
      let counter = 1
      while (usedSlugs.has(slug)) {
        slug = `${generateSlug(trimmedName)}-${counter}`
        counter++
      }
      usedSlugs.add(slug)

      const color = item.color || defaultColors[sIdx % defaultColors.length]

      // 1. Insert Subject
      const { data: newSubject, error: subError } = await supabase
        .from('subjects')
        .insert({
          user_id: user.id,
          name: trimmedName,
          slug,
          total_lectures: lectureCount,
          color,
          sort_order: sIdx + 1,
          is_archived: false,
        })
        .select('id')
        .single()

      if (subError || !newSubject) {
        console.error('[createWorkspace insert subject error]:', subError)
        return {
          success: false,
          error: `Failed to create subject "${trimmedName}": ${subError?.message || 'Database error'}`,
        }
      }

      // 2. Batch-create numbered lectures in chunks of 100 for optimal performance
      const lecturesToInsert = []
      for (let i = 1; i <= lectureCount; i++) {
        lecturesToInsert.push({
          subject_id: newSubject.id,
          user_id: user.id,
          lecture_number: i,
          title: `Lecture ${String(i).padStart(3, '0')}`,
          is_archived: false,
        })
      }

      const chunkSize = 100
      for (let i = 0; i < lecturesToInsert.length; i += chunkSize) {
        const chunk = lecturesToInsert.slice(i, i + chunkSize)
        const { error: lecError } = await supabase.from('lectures').insert(chunk)
        if (lecError) {
          console.error('[createWorkspace insert lectures error]:', lecError)
          return {
            success: false,
            error: `Failed to generate lectures for "${trimmedName}": ${lecError.message}`,
          }
        }
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/tracker')
    revalidatePath('/dashboard/lecture-notes')
    revalidatePath('/dashboard/planner')
    revalidatePath('/dashboard/revision')
    revalidatePath('/dashboard/analytics')
    revalidatePath('/dashboard/settings')

    return { success: true }
  } catch (err: unknown) {
    console.error('[createWorkspace exception]:', err)
    const msg = err instanceof Error ? err.message : 'Failed to create workspace'
    return { success: false, error: msg }
  }
}

/**
 * Adds a new subject to an existing workspace with auto-generated lectures.
 */
export async function addSubject(
  name: string,
  lectureCount: number,
  color?: string
): Promise<{ success: boolean; subjectId?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized. Please sign in.' }
    }

    const cleanName = name.trim()
    if (!cleanName) {
      return { success: false, error: 'Subject name cannot be empty.' }
    }

    const count = Math.max(1, Math.min(500, Math.floor(Number(lectureCount) || 1)))

    // Check existing slugs for this user
    const { data: existingSubjects } = await supabase
      .from('subjects')
      .select('slug, sort_order')
      .eq('user_id', user.id)

    const existingSlugs = new Set((existingSubjects || []).map((s) => s.slug))
    let slug = generateSlug(cleanName)
    let suffix = 1
    while (existingSlugs.has(slug)) {
      slug = `${generateSlug(cleanName)}-${suffix}`
      suffix++
    }

    const nextSortOrder = (existingSubjects?.length || 0) + 1

    const { data: newSubject, error: subError } = await supabase
      .from('subjects')
      .insert({
        user_id: user.id,
        name: cleanName,
        slug,
        total_lectures: count,
        color: color || '#3B82F6',
        sort_order: nextSortOrder,
        is_archived: false,
      })
      .select('id')
      .single()

    if (subError || !newSubject) {
      return { success: false, error: subError?.message || 'Failed to create subject.' }
    }

    // Insert lectures
    const lecturesToInsert = []
    for (let i = 1; i <= count; i++) {
      lecturesToInsert.push({
        subject_id: newSubject.id,
        user_id: user.id,
        lecture_number: i,
        title: `Lecture ${String(i).padStart(3, '0')}`,
        is_archived: false,
      })
    }

    const chunkSize = 100
    for (let i = 0; i < lecturesToInsert.length; i += chunkSize) {
      const chunk = lecturesToInsert.slice(i, i + chunkSize)
      const { error: lecError } = await supabase.from('lectures').insert(chunk)
      if (lecError) {
        return { success: false, error: lecError.message }
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/tracker')
    revalidatePath('/dashboard/lecture-notes')
    revalidatePath('/dashboard/planner')
    revalidatePath('/dashboard/revision')
    revalidatePath('/dashboard/analytics')
    revalidatePath('/dashboard/settings')

    return { success: true, subjectId: newSubject.id }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to add subject'
    return { success: false, error: msg }
  }
}

/**
 * Renames an existing subject.
 */
export async function renameSubject(
  subjectId: string,
  newName: string
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

    const cleanName = newName.trim()
    if (!cleanName) {
      return { success: false, error: 'Subject name cannot be empty.' }
    }

    const { error } = await supabase
      .from('subjects')
      .update({ name: cleanName })
      .eq('id', subjectId)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/tracker')
    revalidatePath('/dashboard/lecture-notes')
    revalidatePath('/dashboard/planner')
    revalidatePath('/dashboard/revision')
    revalidatePath('/dashboard/analytics')
    revalidatePath('/dashboard/settings')

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rename subject'
    return { success: false, error: msg }
  }
}

/**
 * Deletes or archives a subject with safety protections.
 */
export async function deleteSubject(
  subjectId: string,
  archiveOnly: boolean = false
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

    if (archiveOnly) {
      // Soft-delete/archive to preserve notes and history
      await supabase
        .from('subjects')
        .update({ is_archived: true })
        .eq('id', subjectId)
        .eq('user_id', user.id)

      await supabase
        .from('lectures')
        .update({ is_archived: true })
        .eq('subject_id', subjectId)
        .eq('user_id', user.id)
    } else {
      // Hard delete (cascades per DB schema)
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', subjectId)
        .eq('user_id', user.id)

      if (error) {
        return { success: false, error: error.message }
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/tracker')
    revalidatePath('/dashboard/lecture-notes')
    revalidatePath('/dashboard/planner')
    revalidatePath('/dashboard/revision')
    revalidatePath('/dashboard/analytics')
    revalidatePath('/dashboard/settings')

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete subject'
    return { success: false, error: msg }
  }
}

/**
 * Adds additional lectures to an existing subject.
 */
export async function addLecturesToSubject(
  subjectId: string,
  additionalCount: number
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

    const countToAdd = Math.max(1, Math.min(200, Math.floor(Number(additionalCount) || 1)))

    // Get current subject and highest lecture number
    const { data: subject, error: subErr } = await supabase
      .from('subjects')
      .select('id, total_lectures')
      .eq('id', subjectId)
      .eq('user_id', user.id)
      .single()

    if (subErr || !subject) {
      return { success: false, error: 'Subject not found.' }
    }

    const { data: highestLecture } = await supabase
      .from('lectures')
      .select('lecture_number')
      .eq('subject_id', subjectId)
      .eq('user_id', user.id)
      .order('lecture_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const startNum = (highestLecture?.lecture_number || 0) + 1
    const endNum = startNum + countToAdd - 1

    const newLectures = []
    for (let i = startNum; i <= endNum; i++) {
      newLectures.push({
        subject_id: subjectId,
        user_id: user.id,
        lecture_number: i,
        title: `Lecture ${String(i).padStart(3, '0')}`,
        is_archived: false,
      })
    }

    const { error: insertErr } = await supabase.from('lectures').insert(newLectures)
    if (insertErr) {
      return { success: false, error: insertErr.message }
    }

    // Update subject total_lectures
    const newTotal = (subject.total_lectures || 0) + countToAdd
    await supabase
      .from('subjects')
      .update({ total_lectures: newTotal })
      .eq('id', subjectId)
      .eq('user_id', user.id)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/tracker')
    revalidatePath('/dashboard/lecture-notes')
    revalidatePath('/dashboard/planner')
    revalidatePath('/dashboard/revision')
    revalidatePath('/dashboard/analytics')

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to add lectures'
    return { success: false, error: msg }
  }
}

/**
 * Renames an individual lecture.
 */
export async function renameLecture(
  lectureId: string,
  newTitle: string
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

    const cleanTitle = newTitle.trim()
    if (!cleanTitle) {
      return { success: false, error: 'Lecture title cannot be empty.' }
    }

    const { error } = await supabase
      .from('lectures')
      .update({ title: cleanTitle })
      .eq('id', lectureId)
      .eq('user_id', user.id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/tracker')
    revalidatePath(`/dashboard/lectures/${lectureId}`)
    revalidatePath('/dashboard/lecture-notes')
    revalidatePath('/dashboard/revision')

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to rename lecture'
    return { success: false, error: msg }
  }
}
