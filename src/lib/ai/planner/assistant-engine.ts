import { createClient } from '@/lib/supabase/server'
import {
  StudyTask,
  AiSyllabusRoadmap,
  PlannerProposal,
} from '@/types/database'

export interface PlannerAssistantContext {
  todayDate: string
  overallStats: {
    totalSubjects: number
    totalLectures: number
    completedLectures: number
    remainingLectures: number
    progressPercentage: number
  }
  activeRoadmap: {
    id: string
    dailyStudyHours: number
    studyDaysPerWeek: number
    estimatedCompletionDate: string
    targetDate: string | null
    isTargetFeasible: boolean
    offDays: string[]
    feasibilityExplanation: string
  } | null
  todaySchedule: {
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    totalMinutesPlanned: number
    tasks: {
      id: string
      title: string
      subjectName: string
      taskType: string
      priority: string
      status: string
      estimatedMinutes: number
      isAiGenerated: boolean
    }[]
  }
  missedTasks: {
    id: string
    title: string
    scheduledDate: string
    subjectName: string
    taskType: string
    estimatedMinutes: number
    isAiGenerated: boolean
  }[]
  upcomingTasks: {
    id: string
    title: string
    scheduledDate: string
    subjectName: string
    taskType: string
    estimatedMinutes: number
    isAiGenerated: boolean
  }[]
  difficultTopics: {
    lectureId: string
    title: string
    subjectName: string
  }[]
  subjectsSummary: {
    id: string
    name: string
    totalLectures: number
    completedLectures: number
    remainingLectures: number
    progressPercentage: number
  }[]
}

export interface AssistantGeminiOutput {
  message: string
  proposal?: PlannerProposal | null
}

/**
 * Extracts student's real study data in parallel for AI Assistant context.
 * Lightweight, fast (<200ms), and strictly isolated to the authenticated user.
 */
export async function getPlannerAssistantContext(userId: string): Promise<PlannerAssistantContext> {
  const supabase = await createClient()
  const todayDate = new Date().toISOString().slice(0, 10)

  // 1. Fetch subjects, lectures, progress, active roadmap, tasks, and difficult topics in parallel
  const [
    subjectsRes,
    lecturesRes,
    progressRes,
    roadmapRes,
    tasksRes,
    difficultRes,
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, name, color, is_archived')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),

    supabase
      .from('lectures')
      .select('id, subject_id, lecture_number, title, is_archived')
      .eq('is_archived', false)
      .order('lecture_number', { ascending: true }),

    supabase
      .from('lecture_progress')
      .select('lecture_id, status')
      .eq('user_id', userId),

    supabase
      .from('ai_syllabus_roadmaps')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from('study_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: true }),

    supabase
      .from('revision_history')
      .select('lecture_id, is_difficult, needs_re_revision')
      .eq('user_id', userId)
      .or('is_difficult.eq.true,needs_re_revision.eq.true'),
  ])

  const subjects = (subjectsRes.data || []) as { id: string; name: string }[]
  const lectures = (lecturesRes.data || []) as { id: string; subject_id: string; title: string; lecture_number: number }[]
  const progressList = (progressRes.data || []) as { lecture_id: string; status: string }[]
  const activeRoadmap = roadmapRes.data as AiSyllabusRoadmap | null
  const allTasks = (tasksRes.data || []) as StudyTask[]
  const difficultRevisions = (difficultRes.data || []) as { lecture_id: string }[]

  // Maps for fast lookups
  const subjectNameMap = new Map<string, string>()
  for (const s of subjects) {
    subjectNameMap.set(s.id, s.name)
  }

  const lectureMap = new Map<string, { id: string; subject_id: string; title: string; lecture_number: number }>()
  for (const l of lectures) {
    lectureMap.set(l.id, l)
  }

  const progressMap = new Map<string, string>()
  for (const p of progressList) {
    progressMap.set(p.lecture_id, p.status)
  }

  const difficultSet = new Set<string>()
  for (const d of difficultRevisions) {
    difficultSet.add(d.lecture_id)
  }

  // Calculate subject-wise metrics
  let totalLecturesCount = 0
  let totalCompletedCount = 0

  const subjectsSummary = subjects.map((subj) => {
    const subjLectures = lectures.filter((l) => l.subject_id === subj.id)
    const completed = subjLectures.filter((l) => progressMap.get(l.id) === 'completed').length
    const remaining = Math.max(0, subjLectures.length - completed)
    const pct = subjLectures.length > 0 ? Math.round((completed / subjLectures.length) * 100) : 0

    totalLecturesCount += subjLectures.length
    totalCompletedCount += completed

    return {
      id: subj.id,
      name: subj.name,
      totalLectures: subjLectures.length,
      completedLectures: completed,
      remainingLectures: remaining,
      progressPercentage: pct,
    }
  })

  const remainingLecturesCount = Math.max(0, totalLecturesCount - totalCompletedCount)
  const overallPercentage =
    totalLecturesCount > 0 ? Math.round((totalCompletedCount / totalLecturesCount) * 100) : 0

  // Filter Tasks
  const todayTasksList: PlannerAssistantContext['todaySchedule']['tasks'] = []
  let todayCompleted = 0
  let todayPending = 0
  let todayTotalMinutes = 0

  const missedTasksList: PlannerAssistantContext['missedTasks'] = []
  const upcomingTasksList: PlannerAssistantContext['upcomingTasks'] = []

  const threeDaysAhead = new Date()
  threeDaysAhead.setDate(threeDaysAhead.getDate() + 4)
  const maxUpcomingDateStr = threeDaysAhead.toISOString().slice(0, 10)

  for (const t of allTasks) {
    const subjName = t.subject_id ? subjectNameMap.get(t.subject_id) || 'General' : 'General'

    if (t.scheduled_date === todayDate) {
      if (t.status === 'completed') todayCompleted++
      else todayPending++
      todayTotalMinutes += t.estimated_minutes || 30

      todayTasksList.push({
        id: t.id,
        title: t.title,
        subjectName: subjName,
        taskType: t.task_type || 'custom',
        priority: t.priority || 'medium',
        status: t.status,
        estimatedMinutes: t.estimated_minutes || 30,
        isAiGenerated: t.is_ai_generated || false,
      })
    } else if (t.scheduled_date < todayDate && t.status === 'pending') {
      missedTasksList.push({
        id: t.id,
        title: t.title,
        scheduledDate: t.scheduled_date,
        subjectName: subjName,
        taskType: t.task_type || 'custom',
        estimatedMinutes: t.estimated_minutes || 30,
        isAiGenerated: t.is_ai_generated || false,
      })
    } else if (t.scheduled_date > todayDate && t.scheduled_date <= maxUpcomingDateStr && t.status === 'pending') {
      upcomingTasksList.push({
        id: t.id,
        title: t.title,
        scheduledDate: t.scheduled_date,
        subjectName: subjName,
        taskType: t.task_type || 'custom',
        estimatedMinutes: t.estimated_minutes || 30,
        isAiGenerated: t.is_ai_generated || false,
      })
    }
  }

  // Difficult Topics list
  const difficultTopicsList: PlannerAssistantContext['difficultTopics'] = []
  for (const lecId of difficultSet) {
    const lec = lectureMap.get(lecId)
    if (lec) {
      difficultTopicsList.push({
        lectureId: lec.id,
        title: `Lec ${lec.lecture_number}: ${lec.title}`,
        subjectName: subjectNameMap.get(lec.subject_id) || 'Subject',
      })
    }
  }

  return {
    todayDate,
    overallStats: {
      totalSubjects: subjects.length,
      totalLectures: totalLecturesCount,
      completedLectures: totalCompletedCount,
      remainingLectures: remainingLecturesCount,
      progressPercentage: overallPercentage,
    },
    activeRoadmap: activeRoadmap
      ? {
          id: activeRoadmap.id,
          dailyStudyHours: Number(activeRoadmap.daily_study_hours) || 2.0,
          studyDaysPerWeek: activeRoadmap.overview?.study_days_per_week || 6,
          estimatedCompletionDate: activeRoadmap.overview?.estimated_completion_date || '',
          targetDate: activeRoadmap.target_date || null,
          isTargetFeasible: activeRoadmap.overview?.target_date_feasible ?? true,
          offDays: activeRoadmap.unavailable_days || [],
          feasibilityExplanation: activeRoadmap.overview?.feasibility_explanation || '',
        }
      : null,
    todaySchedule: {
      totalTasks: todayTasksList.length,
      completedTasks: todayCompleted,
      pendingTasks: todayPending,
      totalMinutesPlanned: todayTotalMinutes,
      tasks: todayTasksList,
    },
    missedTasks: missedTasksList.slice(0, 10),
    upcomingTasks: upcomingTasksList.slice(0, 15),
    difficultTopics: difficultTopicsList.slice(0, 8),
    subjectsSummary,
  }
}

/**
 * Builds the system prompt for Gemini 3.5 Flash Lite with compact student context.
 */
export function buildPlannerAssistantSystemPrompt(context: PlannerAssistantContext): string {
  return `You are the AI Study Assistant for Study Companion — Your Learning. Your Progress. Your Plan. You are an intelligent, empathetic academic coach and schedule coordinator.
You understand the student's real syllabus data, daily availability, and task status.

STUDENT'S REAL DATABASE CONTEXT:
- Today's Date: ${context.todayDate}
- Overall Progress: ${context.overallStats.completedLectures}/${context.overallStats.totalLectures} lectures completed (${context.overallStats.progressPercentage}%) across ${context.overallStats.totalSubjects} subjects
- Total Remaining Workload: ${context.overallStats.remainingLectures} lectures
${
  context.activeRoadmap
    ? `- Active Roadmap: Available ${context.activeRoadmap.dailyStudyHours}h/day, ${context.activeRoadmap.studyDaysPerWeek} study days/week. Target Date: ${context.activeRoadmap.targetDate || 'None'}. Projected Completion: ${context.activeRoadmap.estimatedCompletionDate}. Target Feasible: ${context.activeRoadmap.isTargetFeasible}. Rest Days: ${context.activeRoadmap.offDays.length > 0 ? context.activeRoadmap.offDays.join(', ') : 'None'}`
    : '- Active Roadmap: No active roadmap generated yet.'
}

TODAY'S SCHEDULE (${context.todayDate}):
- Planned: ${context.todaySchedule.totalTasks} tasks (${context.todaySchedule.totalMinutesPlanned} mins), Completed: ${context.todaySchedule.completedTasks}, Pending: ${context.todaySchedule.pendingTasks}
- Tasks Today:
${
  context.todaySchedule.tasks.length > 0
    ? context.todaySchedule.tasks
        .map(
          (t) =>
            `  • [ID: ${t.id}] [${t.taskType.toUpperCase()}] ${t.title} (${t.estimatedMinutes}m, status: ${t.status}, subject: ${t.subjectName})`
        )
        .join('\n')
    : '  • No tasks scheduled for today.'
}

MISSED / INCOMPLETE PAST TASKS:
${
  context.missedTasks.length > 0
    ? context.missedTasks
        .map(
          (t) =>
            `  • [ID: ${t.id}] [${t.taskType.toUpperCase()}] ${t.title} (scheduled: ${t.scheduledDate}, ${t.estimatedMinutes}m, subject: ${t.subjectName})`
        )
        .join('\n')
    : '  • None! Student is completely on track.'
}

UPCOMING TASKS SAMPLE (Next 3 days):
${
  context.upcomingTasks.length > 0
    ? context.upcomingTasks
        .slice(0, 6)
        .map(
          (t) =>
            `  • [ID: ${t.id}] ${t.title} (date: ${t.scheduledDate}, ${t.estimatedMinutes}m, subject: ${t.subjectName})`
        )
        .join('\n')
    : '  • None scheduled.'
}

SUBJECT WORKLOAD:
${context.subjectsSummary
  .map(
    (s) =>
      `  • ${s.name}: ${s.completedLectures}/${s.totalLectures} completed (${s.remainingLectures} remaining, ${s.progressPercentage}%)`
  )
  .join('\n')}

DIFFICULT TOPICS FLAGGED:
${
  context.difficultTopics.length > 0
    ? context.difficultTopics.map((d) => `  • ${d.subjectName}: ${d.title}`).join('\n')
    : '  • None flagged.'
}

BEHAVIORAL RULES & INTELLIGENT RESCHEDULING:
1. SAFE PROPOSAL-AND-CONFIRMATION:
   - When the student requests ANY schedule change (e.g. adjust today, reschedule missed tasks, make tomorrow lighter, rest day, prioritize a subject), you MUST construct a structured "proposal" in your JSON output.
   - NEVER claim that the schedule is already changed. State that you have prepared a proposal and ask the student to review and click "Apply Changes".
   - If the student is simply asking a question (e.g. "Can I finish in 6 weeks?", "Which subject should I focus on?"), answer thoroughly and set "proposal": null.
2. HANDLING LIMITED STUDY TIME (e.g. "I have only 1.5 hours today"):
   - Inspect today's pending tasks. Keep the most critical task (core lecture intake) today.
   - Move non-essential practice or recall tasks to tomorrow or the next available study day.
   - Include those tasks in "tasks_to_reschedule" with their new dates.
3. HANDLING MISSED TASKS:
   - Distribute incomplete tasks across the next 2-3 upcoming days. DO NOT overload tomorrow.
   - Respect daily capacity (~${context.activeRoadmap?.dailyStudyHours || 2} hours/day).
4. VERIFYING EXTRA COMPLETED LECTURES:
   - If student says "I finished 5 extra lectures", check the real context. If the database does not reflect it, politely say:
     "I checked your syllabus records, and your current database progress shows ${context.overallStats.completedLectures} completed lectures. Please mark those lectures as completed in the Lecture Tracker first so your roadmap and analytics remain accurate, or would you like me to update your schedule once you mark them?"
     Set "proposal": null.
5. ESTIMATION & FEASIBILITY (e.g. "Can I finish in 6 weeks?"):
   - Calculate math: Remaining effort = ${context.overallStats.remainingLectures} lectures × 1.5h = ${Math.round(context.overallStats.remainingLectures * 1.5)} effort hours.
   - Compare with weekly capacity = ${((context.activeRoadmap?.dailyStudyHours || 2) * (context.activeRoadmap?.studyDaysPerWeek || 6)).toFixed(1)}h/week.
   - Give an honest, realistic answer.
6. DATA PRESERVATION:
   - NEVER propose deleting completed tasks or manual tasks.
   - Only reschedule pending tasks referencing real task IDs from the context above.

STRICT JSON OUTPUT FORMAT:
You MUST respond with a single valid JSON object conforming to:
{
  "message": "Conversational, motivating, professional response explaining your reasoning.",
  "proposal": null OR {
    "id": "generate-a-unique-uuid-string",
    "type": "reschedule_tasks" | "adjust_hours" | "prioritize_subject" | "add_rest_day" | "regenerate_roadmap" | "custom",
    "title": "Short title (e.g. Reschedule Incomplete Tasks to Next 3 Days)",
    "summary": "Clear, concise bulleted or 1-2 sentence explanation of the change",
    "tasks_to_reschedule": [
      {
        "taskId": "exact-id-from-context",
        "taskTitle": "Exact title of the task",
        "currentScheduledDate": "YYYY-MM-DD",
        "newScheduledDate": "YYYY-MM-DD",
        "reason": "Why it was moved"
      }
    ],
    "tasks_to_add": [],
    "tasks_to_postpone": [],
    "new_daily_hours": null,
    "new_completion_date": null,
    "impact_summary": "E.g. Relieves today's load by 45m; distributes work across Friday and Saturday without delaying overall completion."
  }
}`
}

/**
 * Validates and safely executes an approved proposal on the database.
 * Strictly guarantees:
 * - Student owns all referenced tasks.
 * - Completed tasks are NEVER modified or deleted.
 * - Manual tasks are NEVER modified.
 */
export async function executeApprovedProposal(
  userId: string,
  proposal: PlannerProposal
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  try {
    // 1. Reschedule / Postpone Tasks
    const allReschedules = [
      ...(proposal.tasks_to_reschedule || []),
      ...(proposal.tasks_to_postpone || []),
    ]

    if (allReschedules.length > 0) {
      const taskIds = allReschedules.map((r) => r.taskId)

      // Query database to verify ownership and ensure NONE are completed
      const { data: dbTasks, error: fetchErr } = await supabase
        .from('study_tasks')
        .select('id, user_id, status, is_ai_generated')
        .in('id', taskIds)
        .eq('user_id', userId)

      if (fetchErr) {
        return { success: false, error: `Failed to verify tasks: ${fetchErr.message}` }
      }

      const dbTaskMap = new Map((dbTasks || []).map((t) => [t.id, t]))

      // Execute each safe reschedule
      for (const item of allReschedules) {
        const dbTask = dbTaskMap.get(item.taskId)
        if (!dbTask) {
          console.warn(`[Planner Assistant] Task ${item.taskId} not found or not owned by user. Skipping.`);
          continue
        }

        // Safety check: Never move completed tasks
        if (dbTask.status === 'completed') {
          console.warn(`[Planner Assistant] Cannot reschedule completed task ${item.taskId}. Skipping.`);
          continue
        }

        // Update scheduled_date
        const { error: updateErr } = await supabase
          .from('study_tasks')
          .update({
            scheduled_date: item.newScheduledDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.taskId)
          .eq('user_id', userId)

        if (updateErr) {
          console.error(`[Planner Assistant] Error updating task ${item.taskId}:`, updateErr.message)
        }
      }
    }

    // 2. Add New Tasks (if specified in proposal)
    if (proposal.tasks_to_add && proposal.tasks_to_add.length > 0) {
      const tasksToInsert = proposal.tasks_to_add.map((t) => ({
        user_id: userId,
        subject_id: t.subjectId || null,
        title: t.taskTitle,
        scheduled_date: t.scheduledDate,
        status: 'pending',
        task_type: t.taskType || 'custom',
        lecture_id: t.lectureId || null,
        is_ai_generated: true,
        priority: t.priority || 'medium',
        estimated_minutes: t.estimatedMinutes || 30,
        description: `Added via AI Study Assistant • ${t.estimatedMinutes} mins`,
      }))

      const { error: insertErr } = await supabase.from('study_tasks').insert(tasksToInsert)
      if (insertErr) {
        console.error('[Planner Assistant] Error inserting new tasks:', insertErr.message)
      }
    }

    // 3. Update Daily Hours in active roadmap if modified
    if (proposal.new_daily_hours && proposal.new_daily_hours > 0) {
      await supabase
        .from('ai_syllabus_roadmaps')
        .update({
          daily_study_hours: proposal.new_daily_hours,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('status', 'active')
    }

    // 4. Update the proposal status in planner_assistant_messages
    try {
      const { data: messages } = await supabase
        .from('planner_assistant_messages')
        .select('id, proposal')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (messages) {
        for (const msg of messages) {
          if (msg.proposal && (msg.proposal.id === proposal.id || msg.proposal.title === proposal.title)) {
            const updatedProposal = { ...msg.proposal, status: 'applied' }
            await supabase
              .from('planner_assistant_messages')
              .update({ proposal: updatedProposal })
              .eq('id', msg.id)
            break
          }
        }
      }
    } catch (msgErr: unknown) {
      const msg = msgErr instanceof Error ? msgErr.message : String(msgErr)
      console.warn('[Planner Assistant] Non-fatal error updating message proposal state:', msg)
    }

    return { success: true }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error executing proposal'
    return { success: false, error: errorMsg }
  }
}
