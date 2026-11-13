'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getDecryptedUserApiKey } from '@/lib/ai/byok-actions'
import { generateStructuredJson } from '@/lib/ai/gemini'
import { BASE_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import {
  analyzeStudentSyllabus,
  calculateStudyCapacity,
  buildDeterministicRoadmap,
} from './engine'
import {
  AiSyllabusRoadmap,
  TaskStatus,
  DailyScheduledTask,
} from '@/types/database'

interface GeminiSyllabusStrategyResponse {
  subject_priorities: {
    subject_id: string
    priority: 'high' | 'medium' | 'low'
    strategy: string
    practice_advice: string
  }[]
  weekly_guidance: string[]
}

/**
 * Server action: Generates a personalized, intelligent syllabus roadmap.
 * Uses hybrid architecture: deterministic mathematics + Gemini pedagogical strategy.
 */
export async function generateSyllabusRoadmapAction({
  dailyStudyHours,
  targetDate,
  unavailableDays = [],
}: {
  dailyStudyHours: number
  targetDate?: string | null
  unavailableDays?: string[]
}): Promise<{
  success: boolean
  roadmap?: AiSyllabusRoadmap
  error?: string
  errorCode?: 'NO_API_KEY' | 'AI_DISABLED' | 'AUTH_ERROR' | 'EMPTY_SYLLABUS' | 'UNKNOWN'
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
        error: 'Unauthorized. Please sign in to generate a roadmap.',
        errorCode: 'AUTH_ERROR',
      }
    }

    // 1. Verify and decrypt student's Gemini API key (BYOK)
    let userApiKey: string
    try {
      userApiKey = await getDecryptedUserApiKey(user.id)
    } catch (keyErr: unknown) {
      const msg = keyErr instanceof Error ? keyErr.message : String(keyErr)
      if (msg.includes('NO_API_KEY')) {
        return {
          success: false,
          error: 'No Gemini API key connected. Please connect your personal Google Gemini API key in Settings -> AI Study Assistant.',
          errorCode: 'NO_API_KEY',
        }
      }
      if (msg.includes('AI_DISABLED')) {
        return {
          success: false,
          error: 'AI capabilities are currently disabled in Settings. Please enable them to use the AI Syllabus Planner.',
          errorCode: 'AI_DISABLED',
        }
      }
      return {
        success: false,
        error: msg || 'AI configuration error. Please check your Settings.',
        errorCode: 'UNKNOWN',
      }
    }

    // 2. Extract and analyze actual syllabus database records
    const analysis = await analyzeStudentSyllabus(user.id)
    if (analysis.total_subjects === 0 || analysis.total_lectures === 0) {
      return {
        success: false,
        error: 'No subjects or lectures found in your account. Please add your subjects in Workspace Management first.',
        errorCode: 'EMPTY_SYLLABUS',
      }
    }

    // 3. Deterministic study capacity & feasibility calculations
    const cleanHours = Math.max(0.5, Math.min(12, Number(dailyStudyHours) || 2.0))
    const overview = calculateStudyCapacity(analysis, cleanHours, unavailableDays, targetDate)

    // 4. Construct Gemini prompt for subject-wise pedagogical strategy
    const subjectsSummary = analysis.subjects.map((s) => ({
      subject_id: s.subject_id,
      name: s.subject_name,
      total_lectures: s.total_lectures,
      completed: s.completed_lectures,
      remaining: s.remaining_lectures,
      difficult_topics_count: s.difficult_lectures_count,
    }))

    const prompt = `You are the Lead Academic Curriculum Director and Study Strategist for Study Companion.
A student needs an intelligent, pedagogical strategy to complete their actual syllabus.

STUDENT PROFILE & CONSTRAINTS:
- Daily Study Availability: ${cleanHours} hours per day
- Study Days Per Week: ${overview.study_days_per_week} days (Off days: ${unavailableDays.length > 0 ? unavailableDays.join(', ') : 'None'})
- Total Subjects: ${analysis.total_subjects}
- Overall Syllabus Progress: ${analysis.completed_lectures}/${analysis.total_lectures} lectures completed (${analysis.overall_progress_percentage}%)
- Total Remaining Workload: ${analysis.remaining_lectures} lectures
${targetDate ? `- Target Exam / Completion Date: ${targetDate} (Feasible: ${overview.target_date_feasible})` : ''}

SUBJECT METRICS:
${JSON.stringify(subjectsSummary, null, 2)}

DIFFICULT TOPICS NEEDING RE-REVISION:
${JSON.stringify(analysis.difficult_topics.slice(0, 8), null, 2)}

INSTRUCTIONS:
Provide pedagogical subject prioritization and learning strategies tailored to each subject:
1. For each subject:
   - Assign priority ('high' | 'medium' | 'low') based on remaining lectures, complexity, and difficult topics.
   - Provide a concise learning strategy (e.g. how to approach lectures, notes, and active recall).
   - Provide specific practice advice (e.g. problem solving, grammar exercises, vocabulary review, or flashcards).
2. Provide 2-3 weekly milestone guidance tips.

Return STRICTLY valid JSON conforming to this schema:
{
  "subject_priorities": [
    {
      "subject_id": "string (must match the exact subject_id from input)",
      "priority": "high" | "medium" | "low",
      "strategy": "string",
      "practice_advice": "string"
    }
  ],
  "weekly_guidance": ["string"]
}`

    // 5. Generate strategy from Gemini 3.5 Flash Lite
    let geminiStrategy: GeminiSyllabusStrategyResponse = { subject_priorities: [], weekly_guidance: [] }
    try {
      geminiStrategy = await generateStructuredJson<GeminiSyllabusStrategyResponse>(
        userApiKey,
        prompt,
        BASE_SYSTEM_PROMPT
      )
    } catch (aiErr: unknown) {
      const msg = aiErr instanceof Error ? aiErr.message : String(aiErr)
      console.warn('[AI Syllabus Planner] Gemini strategy failed, falling back to heuristic priority:', msg)
      // Graceful fallback to heuristic strategy if Gemini fails
      geminiStrategy = {
        subject_priorities: analysis.subjects.map((s) => ({
          subject_id: s.subject_id,
          priority: s.remaining_lectures > 20 ? 'high' : 'medium',
          strategy: 'Focus on consistent daily lecture intake with structured notes.',
          practice_advice: 'Solve end-of-lecture practice questions on the same day.',
        })),
        weekly_guidance: ['Review completed topics at the end of each week.'],
      }
    }

    // 6. Build deterministic roadmap binding strategy to actual database lecture IDs
    const { subject_roadmaps, weekly_milestones, daily_schedule, weekly_review } =
      buildDeterministicRoadmap(analysis, overview, geminiStrategy, unavailableDays)

    // 7. Archive any previous active roadmaps for this user
    await supabase
      .from('ai_syllabus_roadmaps')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'active')

    // 8. Persist new roadmap to Supabase
    const { data: newRoadmap, error: insertRoadmapErr } = await supabase
      .from('ai_syllabus_roadmaps')
      .insert({
        user_id: user.id,
        daily_study_hours: cleanHours,
        target_date: targetDate || null,
        unavailable_days: unavailableDays,
        status: 'active',
        overview,
        subject_roadmaps,
        weekly_milestones,
        daily_schedule,
        weekly_review,
      })
      .select('*')
      .single()

    if (insertRoadmapErr || !newRoadmap) {
      return {
        success: false,
        error: insertRoadmapErr?.message || 'Failed to save generated syllabus roadmap to database.',
        errorCode: 'UNKNOWN',
      }
    }

    // 9. Synchronize daily tasks into `study_tasks` table
    // PRESERVATION RULES:
    // a. Never touch manual tasks (`is_ai_generated = false`).
    // b. Never delete or overwrite already completed tasks (`status = 'completed'`).
    // c. Delete only uncompleted/pending AI tasks from previous roadmaps before inserting new tasks.
    await supabase
      .from('study_tasks')
      .delete()
      .eq('user_id', user.id)
      .eq('is_ai_generated', true)
      .eq('status', 'pending')

    // Insert new scheduled tasks from daily_schedule into study_tasks
    const tasksToInsert = []
    for (const day of daily_schedule) {
      if (day.is_off_day) continue
      for (const t of day.tasks) {
        tasksToInsert.push({
          user_id: user.id,
          subject_id: t.subject_id || null,
          title: t.task_title,
          description: `Estimated: ${t.estimated_minutes} mins • Priority: ${t.priority.toUpperCase()}`,
          scheduled_date: day.date,
          status: 'pending' as TaskStatus,
          task_type: t.task_type,
          lecture_id: t.lecture_id || null,
          is_ai_generated: true,
          roadmap_id: newRoadmap.id,
          priority: t.priority,
          estimated_minutes: t.estimated_minutes,
        })
      }
    }

    if (tasksToInsert.length > 0) {
      const { error: taskInsertErr } = await supabase.from('study_tasks').insert(tasksToInsert)
      if (taskInsertErr) {
        console.warn('[AI Syllabus Planner] Warning inserting study_tasks:', taskInsertErr.message)
      }
    }

    revalidatePath('/dashboard/planner')
    return {
      success: true,
      roadmap: newRoadmap as AiSyllabusRoadmap,
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to generate AI Syllabus Roadmap. Please try again.'
    console.error('[generateSyllabusRoadmapAction error]:', err)
    return {
      success: false,
      error: errorMsg,
      errorCode: 'UNKNOWN',
    }
  }
}

/**
 * Server action: Retrieves the current active roadmap for the authenticated student.
 * Dynamically reconciles live lecture progress and task completion.
 */
export async function getActiveSyllabusRoadmapAction(): Promise<{
  success: boolean
  roadmap?: AiSyllabusRoadmap | null
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

    const { data: roadmap, error: rError } = await supabase
      .from('ai_syllabus_roadmaps')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (rError) {
      // Table may not exist yet if migration 007 is pending
      if (rError.message?.includes('schema cache') || rError.message?.includes('does not exist')) {
        return { success: true, roadmap: null }
      }
      return { success: false, error: rError.message }
    }

    if (!roadmap) {
      return { success: true, roadmap: null }
    }

    // Reconcile task completion status from study_tasks table
    const { data: currentTasks } = await supabase
      .from('study_tasks')
      .select('title, scheduled_date, status, task_type, lecture_id')
      .eq('user_id', user.id)
      .eq('roadmap_id', roadmap.id)

    if (currentTasks && currentTasks.length > 0) {
      const taskStatusMap = new Map<string, TaskStatus>()
      for (const ct of currentTasks) {
        taskStatusMap.set(`${ct.scheduled_date}_${ct.title}`, ct.status as TaskStatus)
      }

      // Update in-memory daily_schedule with live status
      const updatedSchedule = (roadmap.daily_schedule as { date: string; tasks?: DailyScheduledTask[] }[]).map((day) => ({
        ...day,
        tasks: (day.tasks || []).map((t: DailyScheduledTask) => ({
          ...t,
          status: taskStatusMap.get(`${day.date}_${t.task_title}`) || t.status || 'pending',
        })),
      }))

      roadmap.daily_schedule = updatedSchedule
    }

    return { success: true, roadmap: roadmap as AiSyllabusRoadmap }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch roadmap.'
    return { success: false, error: errorMsg }
  }
}

/**
 * Server action: Updates a task status in the Daily Planner & Roadmap schedule.
 */
export async function updateRoadmapTaskStatusAction({
  taskId,
  status,
}: {
  taskId: string
  status: TaskStatus
  roadmapId?: string | null
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized.' }
    }

    const completedAt = status === 'completed' ? new Date().toISOString() : null

    const { error: updateErr } = await supabase
      .from('study_tasks')
      .update({
        status,
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
    const errorMsg = err instanceof Error ? err.message : 'Failed to update task status.'
    return { success: false, error: errorMsg }
  }
}

/**
 * Server action: Archives the current active roadmap.
 */
export async function archiveSyllabusRoadmapAction(
  roadmapId: string
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

    const { error: archErr } = await supabase
      .from('ai_syllabus_roadmaps')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', roadmapId)
      .eq('user_id', user.id)

    if (archErr) {
      return { success: false, error: archErr.message }
    }

    revalidatePath('/dashboard/planner')
    return { success: true }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to archive roadmap.'
    return { success: false, error: errorMsg }
  }
}
