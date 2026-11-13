import { createClient } from '@/lib/supabase/server'
import {
  Subject,
  Lecture,
  StudyTask,
  AiSyllabusRoadmap,
  PlannerProposal,
} from '@/types/database'
import { BASE_SYSTEM_PROMPT } from '@/lib/ai/prompts'

export interface OverviewSubjectProgress {
  id: string
  name: string
  slug: string
  totalLectures: number
  completedLectures: number
  inProgressLectures: number
  remainingLectures: number
  progressPercentage: number
  status: 'completed' | 'strong' | 'moderate' | 'needs_attention'
}

export interface OverviewAssistantContext {
  todayDate: string
  hasConfiguredWorkspace: boolean
  overallStats: {
    totalSubjects: number
    totalLectures: number
    completedLectures: number
    inProgressLectures: number
    remainingLectures: number
    progressPercentage: number
  }
  subjectBreakdown: OverviewSubjectProgress[]
  revisionStatus: {
    overdueCount: number
    dueTodayCount: number
    upcomingCount: number
    overdueList: {
      id: string
      title: string
      subjectName: string
      scheduledDate: string
      daysOverdue: number
    }[]
    dueTodayList: {
      id: string
      title: string
      subjectName: string
    }[]
    difficultLecturesCount: number
    difficultLectures: {
      lectureId: string
      title: string
      subjectName: string
    }[]
    recentRevisions: {
      lectureTitle: string
      subjectName: string
      revisedAt: string
    }[]
  }
  plannerStatus: {
    todayTotal: number
    todayCompleted: number
    todayPending: number
    todayTasks: {
      id: string
      title: string
      subjectName: string
      status: string
      priority: string
      estimatedMinutes: number
    }[]
    missedTasksCount: number
    missedTasks: {
      id: string
      title: string
      scheduledDate: string
      subjectName: string
      estimatedMinutes: number
    }[]
    upcomingTasksCount: number
  }
  activeRoadmap: {
    hasActiveRoadmap: boolean
    dailyStudyHours: number
    studyDaysPerWeek: number
    targetDate: string | null
    estimatedCompletionDate: string | null
    isTargetFeasible: boolean | null
    unavailableDays: string[]
  }
  calculatedFeasibility: {
    daysToCompleteAt2LecturesPerDay: number
    daysToCompleteAt3LecturesPerDay: number
    targetDaysRemaining: number | null
    requiredLecturesPerDayForTarget: number | null
    isTargetPaceRealistic: boolean | null
  }
  detectedAreasNeedingAttention: {
    type: 'lagging_subject' | 'overdue_revisions' | 'missed_tasks' | 'no_roadmap' | 'pace_warning'
    title: string
    observation: string
    suggestion: string
  }[]
}

export interface OverviewGeminiOutput {
  message: string
  suggestedFollowUps?: string[]
  proposal?: PlannerProposal | null
}

/**
 * Compiles a comprehensive, strictly authenticated study context for the student.
 * All numerical calculations (completion percentages, days remaining, lecture totals)
 * are computed deterministically in application code so Gemini never hallucinates numbers.
 */
export async function getOverviewAssistantContext(userId: string): Promise<OverviewAssistantContext> {
  const supabase = await createClient()
  const todayDate = new Date().toISOString().slice(0, 10)

  // 1. Fetch subjects, lectures, progress, tasks, revisions, and roadmap in parallel
  const [
    subjectsRes,
    lecturesRes,
    progressRes,
    tasksRes,
    scheduledRevisionsRes,
    revisionHistoryRes,
    roadmapRes,
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('lectures')
      .select('id, subject_id, lecture_number, title')
      .eq('user_id', userId)
      .eq('is_archived', false),
    supabase
      .from('lecture_progress')
      .select('lecture_id, status, started_at, completed_at')
      .eq('user_id', userId),
    supabase
      .from('study_tasks')
      .select('*, subjects(id, name)')
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: true }),
    supabase
      .from('revision_sessions')
      .select('*, subjects(id, name)')
      .eq('user_id', userId)
      .eq('status', 'scheduled'),
    supabase
      .from('revision_history')
      .select('id, lecture_id, revised_at, is_difficult, lectures(id, title, subjects(id, name))')
      .eq('user_id', userId)
      .order('revised_at', { ascending: false })
      .limit(10),
    supabase
      .from('ai_syllabus_roadmaps')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const subjects = (subjectsRes.data || []) as Subject[]
  const lectures = lecturesRes.data || []
  const progressMap = new Map<string, string>()
  for (const p of progressRes.data || []) {
    progressMap.set(p.lecture_id, p.status)
  }

  // 2. Compute Subject-Wise Progress & Overall Stats
  const subjectBreakdown: OverviewSubjectProgress[] = []
  let totalCurriculumLectures = 0
  let totalCompletedLectures = 0
  let totalInProgressLectures = 0

  for (const sub of subjects) {
    const subLectures = lectures.filter((l) => l.subject_id === sub.id)
    const totalCount = sub.total_lectures || subLectures.length || 0
    let completedCount = 0
    let inProgressCount = 0

    for (const lec of subLectures) {
      const st = progressMap.get(lec.id)
      if (st === 'completed') completedCount++
      else if (st === 'in_progress') inProgressCount++
    }

    const remainingCount = Math.max(0, totalCount - completedCount)
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    totalCurriculumLectures += totalCount
    totalCompletedLectures += completedCount
    totalInProgressLectures += inProgressCount

    let status: OverviewSubjectProgress['status'] = 'moderate'
    if (pct === 100) status = 'completed'
    else if (pct >= 60) status = 'strong'
    else if (pct < 30) status = 'needs_attention'

    subjectBreakdown.push({
      id: sub.id,
      name: sub.name,
      slug: sub.slug,
      totalLectures: totalCount,
      completedLectures: completedCount,
      inProgressLectures: inProgressCount,
      remainingLectures: remainingCount,
      progressPercentage: pct,
      status,
    })
  }

  const remainingCurriculumLectures = Math.max(0, totalCurriculumLectures - totalCompletedLectures)
  const overallPercentage =
    totalCurriculumLectures > 0
      ? Math.round((totalCompletedLectures / totalCurriculumLectures) * 100)
      : 0

  // 3. Process Revision Information
  const scheduledRevisions = scheduledRevisionsRes.data || []
  const overdueList: OverviewAssistantContext['revisionStatus']['overdueList'] = []
  const dueTodayList: OverviewAssistantContext['revisionStatus']['dueTodayList'] = []
  let upcomingRevisionCount = 0

  for (const s of scheduledRevisions) {
    const sDate = s.scheduled_date
    const subName = (s as any).subjects?.name || 'General'
    if (!sDate) continue

    if (sDate < todayDate) {
      const diffDays = Math.max(
        1,
        Math.round(
          (new Date(todayDate).getTime() - new Date(sDate).getTime()) / (1000 * 60 * 60 * 24)
        )
      )
      overdueList.push({
        id: s.id,
        title: s.title || 'Scheduled Revision',
        subjectName: subName,
        scheduledDate: sDate,
        daysOverdue: diffDays,
      })
    } else if (sDate === todayDate) {
      dueTodayList.push({
        id: s.id,
        title: s.title || 'Scheduled Revision',
        subjectName: subName,
      })
    } else {
      upcomingRevisionCount++
    }
  }

  const recentRevisionsData = revisionHistoryRes.data || []
  const difficultMap = new Map<string, { lectureId: string; title: string; subjectName: string }>()
  const recentRevisionsList: OverviewAssistantContext['revisionStatus']['recentRevisions'] = []

  for (const r of recentRevisionsData) {
    const lec = (r as any).lectures
    const title = lec?.title || 'Lecture'
    const subName = lec?.subjects?.name || 'Subject'

    if (r.is_difficult && lec?.id) {
      difficultMap.set(lec.id, {
        lectureId: lec.id,
        title,
        subjectName: subName,
      })
    }

    recentRevisionsList.push({
      lectureTitle: title,
      subjectName: subName,
      revisedAt: r.revised_at,
    })
  }

  // 4. Process Study Tasks
  const allTasks = (tasksRes.data || []) as StudyTask[]
  const todayTasksList: OverviewAssistantContext['plannerStatus']['todayTasks'] = []
  const missedTasksList: OverviewAssistantContext['plannerStatus']['missedTasks'] = []
  let todayCompletedCount = 0
  let upcomingTasksCount = 0

  for (const t of allTasks) {
    const subName = (t as any).subjects?.name || 'Study Task'
    const sDate = t.scheduled_date

    if (sDate === todayDate) {
      if (t.status === 'completed') todayCompletedCount++
      todayTasksList.push({
        id: t.id,
        title: t.title,
        subjectName: subName,
        status: t.status,
        priority: t.priority || 'medium',
        estimatedMinutes: t.estimated_minutes || 45,
      })
    } else if (sDate < todayDate && t.status === 'pending') {
      missedTasksList.push({
        id: t.id,
        title: t.title,
        scheduledDate: sDate,
        subjectName: subName,
        estimatedMinutes: t.estimated_minutes || 45,
      })
    } else if (sDate > todayDate && t.status === 'pending') {
      upcomingTasksCount++
    }
  }

  // 5. Process Active Roadmap
  const roadmapData = (roadmapRes.data || null) as AiSyllabusRoadmap | null
  const hasActiveRoadmap = !!roadmapData
  const dailyStudyHours = roadmapData?.daily_study_hours || 2.0
  const studyDaysPerWeek = roadmapData?.overview?.study_days_per_week || 6
  const targetDate = roadmapData?.target_date || null
  const estimatedCompletionDate =
    roadmapData?.overview?.estimated_completion_date || null
  const isTargetFeasible = roadmapData?.overview?.target_date_feasible ?? null
  const unavailableDays = roadmapData?.unavailable_days || []

  // 6. Deterministic Feasibility Calculations
  const daysAt2Lec = remainingCurriculumLectures > 0 ? Math.ceil(remainingCurriculumLectures / 2) : 0
  const daysAt3Lec = remainingCurriculumLectures > 0 ? Math.ceil(remainingCurriculumLectures / 3) : 0

  let targetDaysRemaining: number | null = null
  let requiredLecturesPerDayForTarget: number | null = null
  let isTargetPaceRealistic: boolean | null = null

  if (targetDate) {
    const diffMs = new Date(targetDate).getTime() - new Date(todayDate).getTime()
    targetDaysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    requiredLecturesPerDayForTarget =
      remainingCurriculumLectures > 0
        ? parseFloat((remainingCurriculumLectures / targetDaysRemaining).toFixed(1))
        : 0
    isTargetPaceRealistic = requiredLecturesPerDayForTarget <= 3.5
  }

  // 7. Detect Areas Needing Attention
  const areasNeedingAttention: OverviewAssistantContext['detectedAreasNeedingAttention'] = []

  // Overdue revisions check
  if (overdueList.length > 0) {
    areasNeedingAttention.push({
      type: 'overdue_revisions',
      title: `${overdueList.length} Overdue Revision${overdueList.length > 1 ? 's' : ''}`,
      observation: `You have ${overdueList.length} revision session${overdueList.length > 1 ? 's' : ''} past due (including "${overdueList[0].title}" in ${overdueList[0].subjectName}).`,
      suggestion: 'Completing overdue revisions first reinforces earlier concepts and prevents memory decay.',
    })
  }

  // Missed tasks check
  if (missedTasksList.length > 0) {
    areasNeedingAttention.push({
      type: 'missed_tasks',
      title: `${missedTasksList.length} Incomplete Past Task${missedTasksList.length > 1 ? 's' : ''}`,
      observation: `${missedTasksList.length} task${missedTasksList.length > 1 ? 's' : ''} scheduled on earlier days were not completed.`,
      suggestion: 'You can reschedule missed tasks to today or distribute them across tomorrow using the assistant proposal action.',
    })
  }

  // Lagging subject check
  if (subjectBreakdown.length > 1 && remainingCurriculumLectures > 0) {
    const sorted = [...subjectBreakdown].sort((a, b) => a.progressPercentage - b.progressPercentage)
    const lowest = sorted[0]
    const highest = sorted[sorted.length - 1]

    if (highest.progressPercentage - lowest.progressPercentage >= 20 && lowest.remainingLectures > 0) {
      areasNeedingAttention.push({
        type: 'lagging_subject',
        title: `${lowest.name} Needs Pacing Focus`,
        observation: `${lowest.name} is at ${lowest.progressPercentage}% (${lowest.remainingLectures} remaining), while ${highest.name} is at ${highest.progressPercentage}%.`,
        suggestion: `Consider allocating your next study session to ${lowest.name} to keep all syllabus sections balanced.`,
      })
    }
  }

  // Roadmap check
  if (!hasActiveRoadmap && subjects.length > 0) {
    areasNeedingAttention.push({
      type: 'no_roadmap',
      title: 'No Active Syllabus Roadmap',
      observation: 'You do not have an active AI syllabus completion roadmap generated.',
      suggestion: 'Generate an AI Syllabus Roadmap in the Daily Planner to get a milestone-driven completion schedule based on your daily availability.',
    })
  }

  // Target pace warning
  if (targetDate && isTargetPaceRealistic === false) {
    areasNeedingAttention.push({
      type: 'pace_warning',
      title: 'Demanding Target Pace',
      observation: `Finishing by ${targetDate} requires approximately ${requiredLecturesPerDayForTarget} lectures every day across the remaining ${targetDaysRemaining} days.`,
      suggestion: 'Consider adjusting your daily study hours or extending your target date for a sustainable, retention-focused pace.',
    })
  }

  return {
    todayDate,
    hasConfiguredWorkspace: subjects.length > 0,
    overallStats: {
      totalSubjects: subjects.length,
      totalLectures: totalCurriculumLectures,
      completedLectures: totalCompletedLectures,
      inProgressLectures: totalInProgressLectures,
      remainingLectures: remainingCurriculumLectures,
      progressPercentage: overallPercentage,
    },
    subjectBreakdown,
    revisionStatus: {
      overdueCount: overdueList.length,
      dueTodayCount: dueTodayList.length,
      upcomingCount: upcomingRevisionCount,
      overdueList,
      dueTodayList,
      difficultLecturesCount: difficultMap.size,
      difficultLectures: Array.from(difficultMap.values()),
      recentRevisions: recentRevisionsList,
    },
    plannerStatus: {
      todayTotal: todayTasksList.length,
      todayCompleted: todayCompletedCount,
      todayPending: Math.max(0, todayTasksList.length - todayCompletedCount),
      todayTasks: todayTasksList,
      missedTasksCount: missedTasksList.length,
      missedTasks: missedTasksList,
      upcomingTasksCount,
    },
    activeRoadmap: {
      hasActiveRoadmap,
      dailyStudyHours,
      studyDaysPerWeek,
      targetDate,
      estimatedCompletionDate,
      isTargetFeasible,
      unavailableDays,
    },
    calculatedFeasibility: {
      daysToCompleteAt2LecturesPerDay: daysAt2Lec,
      daysToCompleteAt3LecturesPerDay: daysAt3Lec,
      targetDaysRemaining,
      requiredLecturesPerDayForTarget,
      isTargetPaceRealistic,
    },
    detectedAreasNeedingAttention: areasNeedingAttention,
  }
}

/**
 * Builds the comprehensive system instruction for the Overview AI Assistant.
 */
export function buildOverviewAssistantSystemPrompt(context: OverviewAssistantContext): string {
  const jsonContext = JSON.stringify(context, null, 2)

  return `${BASE_SYSTEM_PROMPT}

You are **Ask Study Companion**, the central intelligence companion and strategic guide of Study Companion (tagline: "Your Learning. Your Progress. Your Plan.").
You reside on the student's central Dashboard Overview page. Your role is to understand their overall study progress, identify what needs attention, recommend realistic next actions, answer study management questions, and guide them with actionable links.

### STRICT NUMERICAL CALCULATION RULES:
1. The student's real, verified workspace metrics have been pre-computed deterministically by the application engine and are provided below in the STUDY WORKSPACE CONTEXT JSON.
2. NEVER calculate, invent, round, or alter numerical statistics independently. ALWAYS cite the exact values from the context:
   - Total subjects: ${context.overallStats.totalSubjects}
   - Total curriculum lectures: ${context.overallStats.totalLectures}
   - Completed lectures: ${context.overallStats.completedLectures}
   - Remaining lectures: ${context.overallStats.remainingLectures}
   - Overall syllabus completion percentage: ${context.overallStats.progressPercentage}%
   - Overdue revisions: ${context.revisionStatus.overdueCount}
   - Today's pending tasks: ${context.plannerStatus.todayPending} of ${context.plannerStatus.todayTotal}
   - Missed past tasks: ${context.plannerStatus.missedTasksCount}
3. If an input is not recorded (e.g. historical study duration per session), state honestly that it is not recorded rather than guessing.

### THE FIVE CORE CAPABILITIES:
1. **Understand My Progress**:
   - Give clear, structured summaries of total syllabus completion, subject-wise breakdown, and pending workload.
   - Mention which subjects are leading and which have remaining lectures.
2. **What Should I Study Next?**:
   - Prioritize in this intelligent, pedagogical order:
     a) Overdue or due-today revisions (reinforce old material before it is forgotten).
     b) Today's pending study planner tasks.
     c) The subject with lowest completion or most remaining lectures.
   - Keep recommendations realistic: recommend 1–2 specific lectures or 1 revision at a time. Never assign unrealistic marathons.
3. **Identify Problems and Weak Areas**:
   - Use constructive, neutral, encouraging language. Never say "You are lazy" or "You are falling behind hopelessly".
   - Ground every observation in data (e.g. "Mathematics is at 15% completion with 35 remaining lectures, while English is at 55%").
4. **Answer General Study Questions**:
   - For feasibility questions ("Can I finish in 30 days?"), cite the pre-calculated feasibility metrics:
     - Remaining lectures: ${context.overallStats.remainingLectures}
     - At 2 lectures/day: ~${context.calculatedFeasibility.daysToCompleteAt2LecturesPerDay} study days needed.
     - At 3 lectures/day: ~${context.calculatedFeasibility.daysToCompleteAt3LecturesPerDay} study days needed.
     ${context.calculatedFeasibility.targetDaysRemaining ? `- With target date ${context.activeRoadmap.targetDate}: ${context.calculatedFeasibility.targetDaysRemaining} days remaining, requiring ~${context.calculatedFeasibility.requiredLecturesPerDayForTarget} lectures/day.` : ''}
5. **Help Me Take Action**:
   - Always include clickable markdown links to official Study Companion routes:
     - Tracker: [Open Lecture Tracker](/dashboard/tracker) or subject-specific [Open Mathematics in Tracker](/dashboard/tracker?subject=mathematics)
     - Lecture Notes: [View Lecture Notes](/dashboard/lecture-notes)
     - General Notes: [Open General Notes](/dashboard/general-notes)
     - Revision Centre: [Open Revision Centre](/dashboard/revision)
     - Daily Planner: [Open Daily Planner](/dashboard/planner)
     - AI Syllabus Planner: [Open AI Syllabus Planner](/dashboard/planner)
     - Settings: [Open Settings](/dashboard/settings)
   - When the student asks to change, reschedule, or lighten their schedule (e.g. "Move missed tasks to tomorrow" or "Reschedule yesterday's tasks"):
     - Prepare a concrete proposed adjustment using the "proposal" field in your JSON output.
     - The proposal must match the PlannerProposal schema (title, summary, tasks_to_reschedule, impact_summary).
     - Inform the student that you have prepared the proposal below and they can click "Apply Changes" or "Cancel".

### EMPTY WORKSPACE HANDLING:
If hasConfiguredWorkspace is false (0 subjects configured):
- Explain that their workspace has not been initialized with subjects yet.
- Point them to [Study Companion Settings](/dashboard/settings) or [Workspace Setup](/dashboard/onboarding) to create their subjects.
- Do not fabricate fake syllabus numbers or lectures.

### RESPONSE FORMAT:
You MUST respond with a valid JSON object matching this schema:
{
  "message": "Clear, markdown-formatted response string with paragraphs, bullet points, bold highlights, and links.",
  "suggestedFollowUps": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"],
  "proposal": null | {
    "id": "prop-uuid-or-timestamp",
    "type": "reschedule_tasks",
    "title": "Short title",
    "summary": "Clear summary of the schedule change",
    "status": "pending",
    "tasks_to_reschedule": [
      {
        "taskId": "exact-task-id",
        "taskTitle": "Task title",
        "currentScheduledDate": "YYYY-MM-DD",
        "newScheduledDate": "YYYY-MM-DD",
        "reason": "Short reason"
      }
    ],
    "impact_summary": "Impact description"
  }
}

### CURRENT VERIFIED STUDY WORKSPACE CONTEXT:
${jsonContext}
`
}
