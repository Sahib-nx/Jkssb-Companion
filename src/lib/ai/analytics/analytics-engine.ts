import { createClient } from '@/lib/supabase/server'
import {
  Subject,
  Lecture,
  StudyTask,
  AiSyllabusRoadmap,
  PlannerProposal,
  AnalyticsInsightItem,
} from '@/types/database'
import { BASE_SYSTEM_PROMPT } from '@/lib/ai/prompts'

export interface AnalyticsSubjectMetrics {
  id: string
  name: string
  slug: string
  totalLectures: number
  completedLectures: number
  inProgressLectures: number
  remainingLectures: number
  progressPercentage: number
  revisionCount: number
  difficultCount: number
}

export interface AnalyticsAssistantContext {
  todayDate: string
  overallStats: {
    totalSubjects: number
    totalLectures: number
    completedLectures: number
    inProgressLectures: number
    remainingLectures: number
    progressPercentage: number
  }
  subjectMetrics: AnalyticsSubjectMetrics[]
  subjectComparison: {
    highestSubject: { name: string; percentage: number }
    lowestSubject: { name: string; percentage: number }
    imbalanceGap: number // percentage points difference
    balanceStatus: 'balanced' | 'moderate_imbalance' | 'severe_imbalance'
    diagnosis: string
  }
  velocityAndTrends: {
    totalCompletedLectures: number
    activeStudyDaysCount: number
    firstActivityDate: string | null
    latestActivityDate: string | null
    daysSpan: number
    dailyVelocity: number // completed / activeStudyDays
    recent7DaysCompletions: number
    previous7DaysCompletions: number
    trendDirection: 'accelerating' | 'stable' | 'decelerating' | 'insufficient_history'
    hasGenuineHistoricalTrend: boolean
    trendObservation: string
  }
  studyHabits: {
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    taskSuccessRate: number
    overdueTasksCount: number
    totalRevisionEvents: number
    distinctLecturesRevised: number
    revisionCoveragePercentage: number
    revisionToLectureRatio: string
    isRevisionNeglected: boolean
    habitSummary: string
  }
  weakAreas: {
    difficultLecturesCount: number
    needsReRevisionCount: number
    overdueSessionsCount: number
    difficultLecturesList: { title: string; subjectName: string }[]
    laggingSubjectsList: { name: string; percentage: number; remaining: number }[]
  }
  projections: {
    hasActiveRoadmap: boolean
    roadmapTargetDate: string | null
    dailyStudyHours: number | null
    remainingLectures: number
    projectedCompletionDateAtCurrentVelocity: string | null
    daysRemainingToTarget: number | null
    requiredVelocityPerDay: number | null
    isTargetFeasible: boolean | null
    projectionSummary: string
  }
  deterministicInsights: AnalyticsInsightItem[]
}

export interface AnalyticsGeminiOutput {
  message: string
  insights?: AnalyticsInsightItem[]
  suggestedFollowUps?: string[]
  proposal?: PlannerProposal | null
}

/**
 * Deterministically computes comprehensive analytics metrics directly from the authenticated database.
 * No statistical hallucinations: all sums, percentages, velocities, and date differences
 * are calculated with exact TypeScript logic before Gemini is called.
 */
export async function getAnalyticsAssistantContext(userId: string): Promise<AnalyticsAssistantContext> {
  const supabase = await createClient()
  const todayDate = new Date().toISOString().slice(0, 10)

  // 1. Fetch subjects, lecture progress, revision history, scheduled revisions, study tasks, and active roadmap in parallel
  const [
    subjectsRes,
    lecturesRes,
    progressRes,
    revisionHistoryRes,
    revisionSessionsRes,
    tasksRes,
    roadmapRes,
  ] = await Promise.all([
    supabase
      .from('subjects')
      .select('id, name, slug, total_lectures, order_index')
      .eq('user_id', userId)
      .order('order_index', { ascending: true }),
    supabase
      .from('lectures')
      .select('id, subject_id, title, lecture_number')
      .eq('user_id', userId),
    supabase
      .from('lecture_progress')
      .select('lecture_id, status, started_at, completed_at')
      .eq('user_id', userId),
    supabase
      .from('revision_history')
      .select('lecture_id, revised_at, is_difficult, needs_re_revision')
      .eq('user_id', userId)
      .order('revised_at', { ascending: true }),
    supabase
      .from('revision_sessions')
      .select('id, subject_id, scheduled_date, status')
      .eq('user_id', userId),
    supabase
      .from('study_tasks')
      .select('id, subject_id, scheduled_date, status, estimated_minutes, priority')
      .eq('user_id', userId),
    supabase
      .from('ai_syllabus_roadmaps')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const subjects = (subjectsRes.data || []) as unknown as Subject[]
  const lectures = (lecturesRes.data || []) as Lecture[]
  const progressList = progressRes.data || []
  const revisionHistory = revisionHistoryRes.data || []
  const revisionSessions = revisionSessionsRes.data || []
  const tasks = (tasksRes.data || []) as StudyTask[]
  const activeRoadmap = roadmapRes?.data as AiSyllabusRoadmap | null

  // Maps for efficient lookups
  const lectureSubjectMap = new Map<string, string>() // lecture_id -> subject_id
  const lectureTitleMap = new Map<string, string>() // lecture_id -> title
  for (const lec of lectures) {
    lectureSubjectMap.set(lec.id, lec.subject_id)
    lectureTitleMap.set(lec.id, lec.title)
  }

  const subjectNameMap = new Map<string, string>()
  for (const s of subjects) {
    subjectNameMap.set(s.id, s.name)
  }

  const progressByLecture = new Map<string, { status: string; completed_at: string | null }>()
  for (const p of progressList) {
    progressByLecture.set(p.lecture_id, {
      status: p.status,
      completed_at: p.completed_at,
    })
  }

  // 2. Compute Subject Metrics
  const subjectMetrics: AnalyticsSubjectMetrics[] = subjects.map((sub) => {
    const subLectures = lectures.filter((l) => l.subject_id === sub.id)
    let completedCount = 0
    let inProgressCount = 0

    for (const lec of subLectures) {
      const prog = progressByLecture.get(lec.id)
      if (prog?.status === 'completed') completedCount++
      else if (prog?.status === 'in_progress') inProgressCount++
    }

    const totalLectures = sub.total_lectures || subLectures.length || 0
    const remainingLectures = Math.max(0, totalLectures - completedCount - inProgressCount)
    const progressPercentage = totalLectures > 0 ? Math.round((completedCount / totalLectures) * 100) : 0

    // Revisions & difficult counts in this subject
    let revisionCount = 0
    let difficultCount = 0
    for (const rev of revisionHistory) {
      if (lectureSubjectMap.get(rev.lecture_id) === sub.id) {
        revisionCount++
        if (rev.is_difficult) difficultCount++
      }
    }

    return {
      id: sub.id,
      name: sub.name,
      slug: sub.slug,
      totalLectures,
      completedLectures: completedCount,
      inProgressLectures: inProgressCount,
      remainingLectures,
      progressPercentage,
      revisionCount,
      difficultCount,
    }
  })

  // 3. Overall Stats
  const totalLectures = subjectMetrics.reduce((acc, s) => acc + s.totalLectures, 0)
  const completedLectures = subjectMetrics.reduce((acc, s) => acc + s.completedLectures, 0)
  const inProgressLectures = subjectMetrics.reduce((acc, s) => acc + s.inProgressLectures, 0)
  const remainingLectures = Math.max(0, totalLectures - completedLectures - inProgressLectures)
  const progressPercentage = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0

  // 4. Subject Comparison & Imbalance
  const sortedByProgress = [...subjectMetrics].sort((a, b) => b.progressPercentage - a.progressPercentage)
  const highestSubject = sortedByProgress[0]
    ? { name: sortedByProgress[0].name, percentage: sortedByProgress[0].progressPercentage }
    : { name: 'None', percentage: 0 }
  const lowestSubject = sortedByProgress[sortedByProgress.length - 1]
    ? { name: sortedByProgress[sortedByProgress.length - 1].name, percentage: sortedByProgress[sortedByProgress.length - 1].progressPercentage }
    : { name: 'None', percentage: 0 }
  const imbalanceGap = highestSubject.percentage - lowestSubject.percentage

  let balanceStatus: 'balanced' | 'moderate_imbalance' | 'severe_imbalance' = 'balanced'
  let balanceDiagnosis = 'Subject progress is evenly distributed across your curriculum.'
  if (imbalanceGap > 35) {
    balanceStatus = 'severe_imbalance'
    balanceDiagnosis = `High disparity: ${highestSubject.name} (${highestSubject.percentage}%) is far ahead of ${lowestSubject.name} (${lowestSubject.percentage}%). Risk of syllabus debt in lagging areas.`
  } else if (imbalanceGap > 15) {
    balanceStatus = 'moderate_imbalance'
    balanceDiagnosis = `Moderate disparity: ${highestSubject.name} leads at ${highestSubject.percentage}%, while ${lowestSubject.name} is at ${lowestSubject.percentage}%.`
  }

  // 5. Velocity and Trends
  const completedDates = progressList
    .filter((p) => p.status === 'completed' && p.completed_at)
    .map((p) => p.completed_at!.slice(0, 10))
    .sort()

  const completedByDay = new Map<string, number>()
  for (const date of completedDates) {
    completedByDay.set(date, (completedByDay.get(date) || 0) + 1)
  }

  const uniqueActiveDays = Array.from(completedByDay.keys())
  const activeStudyDaysCount = uniqueActiveDays.length
  const firstActivityDate = uniqueActiveDays[0] || null
  const latestActivityDate = uniqueActiveDays[uniqueActiveDays.length - 1] || null

  let daysSpan = 0
  if (firstActivityDate && latestActivityDate) {
    const start = new Date(firstActivityDate).getTime()
    const end = new Date(latestActivityDate).getTime()
    daysSpan = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1)
  }

  const dailyVelocity = activeStudyDaysCount > 0
    ? Number((completedLectures / activeStudyDaysCount).toFixed(1))
    : 0

  // Trend detection (comparing recent 7 calendar days vs previous 7 calendar days)
  const todayMs = new Date(todayDate).getTime()
  const sevenDaysAgoMs = todayMs - 7 * 24 * 60 * 60 * 1000
  const fourteenDaysAgoMs = todayMs - 14 * 24 * 60 * 60 * 1000

  let recent7DaysCompletions = 0
  let previous7DaysCompletions = 0

  for (const [day, count] of completedByDay.entries()) {
    const dayMs = new Date(day).getTime()
    if (dayMs >= sevenDaysAgoMs && dayMs <= todayMs) {
      recent7DaysCompletions += count
    } else if (dayMs >= fourteenDaysAgoMs && dayMs < sevenDaysAgoMs) {
      previous7DaysCompletions += count
    }
  }

  const hasGenuineHistoricalTrend = activeStudyDaysCount >= 2 && daysSpan >= 3
  let trendDirection: 'accelerating' | 'stable' | 'decelerating' | 'insufficient_history' = 'insufficient_history'
  let trendObservation = 'Single-day or minimal activity logged. More days of study needed to establish a trend.'

  if (hasGenuineHistoricalTrend) {
    if (recent7DaysCompletions > previous7DaysCompletions) {
      trendDirection = 'accelerating'
      trendObservation = `Pace is accelerating: ${recent7DaysCompletions} lectures completed in the last 7 days compared to ${previous7DaysCompletions} in the prior week.`
    } else if (recent7DaysCompletions < previous7DaysCompletions && previous7DaysCompletions > 0) {
      trendDirection = 'decelerating'
      trendObservation = `Pace softened: ${recent7DaysCompletions} lectures completed in the last 7 days compared to ${previous7DaysCompletions} in the prior week.`
    } else {
      trendDirection = 'stable'
      trendObservation = `Steady pace: ${recent7DaysCompletions} lectures finished over the last 7 days.`
    }
  }

  // 6. Study Habits & Execution
  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.status === 'completed').length
  const pendingTasks = totalTasks - completedTasks
  const taskSuccessRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const overdueTasksCount = tasks.filter(
    (t) => t.status === 'pending' && t.scheduled_date && t.scheduled_date < todayDate
  ).length

  const totalRevisionEvents = revisionHistory.length
  const distinctLecturesRevised = new Set(revisionHistory.map((r) => r.lecture_id)).size
  const revisionCoveragePercentage = completedLectures > 0
    ? Math.round((distinctLecturesRevised / completedLectures) * 100)
    : 0

  const revisionRatioNum = completedLectures > 0 && totalRevisionEvents > 0
    ? (completedLectures / totalRevisionEvents).toFixed(1)
    : null
  const revisionToLectureRatio = revisionRatioNum
    ? `1 revision per ${revisionRatioNum} completed lectures`
    : 'No revisions recorded yet'

  const isRevisionNeglected = completedLectures >= 5 && totalRevisionEvents < Math.floor(completedLectures * 0.25)
  let habitSummary = `Task completion rate is ${taskSuccessRate}%. Revision coverage is ${revisionCoveragePercentage}% of finished syllabus.`
  if (isRevisionNeglected) {
    habitSummary += ' Note: New lecture consumption is outstripping revision frequency. Retention risk elevated.'
  }

  // 7. Weak Areas
  const difficultHist = revisionHistory.filter((r) => r.is_difficult)
  const difficultLecturesCount = new Set(difficultHist.map((r) => r.lecture_id)).size
  const needsReRevisionCount = revisionHistory.filter((r) => r.needs_re_revision).length

  const overdueSessionsCount = revisionSessions.filter(
    (s) => s.status === 'scheduled' && s.scheduled_date && s.scheduled_date < todayDate
  ).length

  const difficultLecturesList = Array.from(new Set(difficultHist.map((r) => r.lecture_id)))
    .slice(0, 5)
    .map((lecId) => ({
      title: lectureTitleMap.get(lecId) || 'Lecture',
      subjectName: subjectNameMap.get(lectureSubjectMap.get(lecId) || '') || 'Subject',
    }))

  const laggingSubjectsList = sortedByProgress
    .filter((s) => s.progressPercentage < 50 && s.remainingLectures > 0)
    .map((s) => ({
      name: s.name,
      percentage: s.progressPercentage,
      remaining: s.remainingLectures,
    }))

  // 8. Projections & Feasibility
  let roadmapTargetDate: string | null = null
  let dailyStudyHours: number | null = null
  let daysRemainingToTarget: number | null = null
  let requiredVelocityPerDay: number | null = null
  let isTargetFeasible: boolean | null = null
  let projectedCompletionDateAtCurrentVelocity: string | null = null
  let projectionSummary = 'No projected completion timeline available.'

  if (activeRoadmap) {
    roadmapTargetDate = activeRoadmap.target_date || null
    dailyStudyHours = activeRoadmap.daily_study_hours || null

    if (roadmapTargetDate) {
      const targetMs = new Date(roadmapTargetDate).getTime()
      daysRemainingToTarget = Math.max(0, Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24)))

      if (daysRemainingToTarget > 0 && remainingLectures > 0) {
        requiredVelocityPerDay = Number((remainingLectures / daysRemainingToTarget).toFixed(2))

        // Check feasibility against observed daily velocity
        if (dailyVelocity > 0) {
          isTargetFeasible = requiredVelocityPerDay <= dailyVelocity * 1.3
        }
      }
    }
  }

  // Calculate estimated completion date based on dailyVelocity
  if (dailyVelocity > 0 && remainingLectures > 0) {
    const daysNeeded = Math.ceil(remainingLectures / dailyVelocity)
    const completionMs = todayMs + daysNeeded * 24 * 60 * 60 * 1000
    projectedCompletionDateAtCurrentVelocity = new Date(completionMs).toISOString().slice(0, 10)
    projectionSummary = `At your observed pace of ${dailyVelocity} lectures/day, remaining ${remainingLectures} lectures will be completed around ${projectedCompletionDateAtCurrentVelocity} (~${daysNeeded} study days).`
  } else if (remainingLectures === 0) {
    projectionSummary = 'All configured lectures completed!'
  } else {
    projectionSummary = `${remainingLectures} lectures remain. Establish daily study velocity to project completion date.`
  }

  // 9. Generate Deterministic Insight Badges (100% computed in TypeScript, zero hallucination)
  const deterministicInsights: AnalyticsInsightItem[] = [
    {
      id: 'velocity',
      type: 'velocity',
      title: 'Current Velocity',
      value: dailyVelocity > 0 ? `${dailyVelocity} lec/day` : 'Establishing',
      subtitle: hasGenuineHistoricalTrend ? trendObservation : `${activeStudyDaysCount} active study day${activeStudyDaysCount === 1 ? '' : 's'}`,
      trend: trendDirection === 'accelerating' ? 'up' : trendDirection === 'decelerating' ? 'down' : 'neutral',
      badgeColor: trendDirection === 'accelerating' ? 'emerald' : trendDirection === 'decelerating' ? 'amber' : 'blue',
    },
    {
      id: 'comparison',
      type: 'comparison',
      title: 'Subject Balance',
      value: balanceStatus === 'balanced' ? 'Balanced' : `${imbalanceGap}% Gap`,
      subtitle: `${highestSubject.name} (${highestSubject.percentage}%) vs ${lowestSubject.name} (${lowestSubject.percentage}%)`,
      trend: balanceStatus === 'balanced' ? 'up' : 'down',
      badgeColor: balanceStatus === 'balanced' ? 'emerald' : balanceStatus === 'severe_imbalance' ? 'rose' : 'amber',
    },
    {
      id: 'habit',
      type: 'habit',
      title: 'Task Execution',
      value: `${taskSuccessRate}% Rate`,
      subtitle: `${completedTasks} of ${totalTasks} tasks completed (${overdueTasksCount} overdue)`,
      trend: taskSuccessRate >= 75 ? 'up' : taskSuccessRate >= 50 ? 'neutral' : 'down',
      badgeColor: taskSuccessRate >= 75 ? 'emerald' : taskSuccessRate >= 50 ? 'purple' : 'amber',
    },
    {
      id: 'retention',
      type: 'retention',
      title: 'Revision Health',
      value: overdueSessionsCount > 0 ? `${overdueSessionsCount} Overdue` : `${distinctLecturesRevised} Revised`,
      subtitle: `${revisionCoveragePercentage}% coverage (${difficultLecturesCount} flagged difficult)`,
      trend: overdueSessionsCount === 0 ? 'up' : 'down',
      badgeColor: overdueSessionsCount > 0 ? 'rose' : 'blue',
    },
    {
      id: 'projection',
      type: 'projection',
      title: 'Projected Finish',
      value: projectedCompletionDateAtCurrentVelocity
        ? projectedCompletionDateAtCurrentVelocity
        : `${remainingLectures} Left`,
      subtitle: roadmapTargetDate ? `Target: ${roadmapTargetDate}` : 'No deadline set',
      trend: isTargetFeasible === false ? 'down' : 'neutral',
      badgeColor: isTargetFeasible === false ? 'amber' : 'purple',
    },
  ]

  return {
    todayDate,
    overallStats: {
      totalSubjects: subjects.length,
      totalLectures,
      completedLectures,
      inProgressLectures,
      remainingLectures,
      progressPercentage,
    },
    subjectMetrics,
    subjectComparison: {
      highestSubject,
      lowestSubject,
      imbalanceGap,
      balanceStatus,
      diagnosis: balanceDiagnosis,
    },
    velocityAndTrends: {
      totalCompletedLectures: completedLectures,
      activeStudyDaysCount,
      firstActivityDate,
      latestActivityDate,
      daysSpan,
      dailyVelocity,
      recent7DaysCompletions,
      previous7DaysCompletions,
      trendDirection,
      hasGenuineHistoricalTrend,
      trendObservation,
    },
    studyHabits: {
      totalTasks,
      completedTasks,
      pendingTasks,
      taskSuccessRate,
      overdueTasksCount,
      totalRevisionEvents,
      distinctLecturesRevised,
      revisionCoveragePercentage,
      revisionToLectureRatio,
      isRevisionNeglected,
      habitSummary,
    },
    weakAreas: {
      difficultLecturesCount,
      needsReRevisionCount,
      overdueSessionsCount,
      difficultLecturesList,
      laggingSubjectsList,
    },
    projections: {
      hasActiveRoadmap: !!activeRoadmap,
      roadmapTargetDate,
      dailyStudyHours,
      remainingLectures,
      projectedCompletionDateAtCurrentVelocity,
      daysRemainingToTarget,
      requiredVelocityPerDay,
      isTargetFeasible,
      projectionSummary,
    },
    deterministicInsights,
  }
}

/**
 * Builds the strict, grounded system prompt for the AI Analytics Assistant.
 */
export function buildAnalyticsAssistantSystemPrompt(context: AnalyticsAssistantContext): string {
  return `${BASE_SYSTEM_PROMPT}

You are the AI Analytics Assistant for the Study Companion platform — Your Learning. Your Progress. Your Plan.

CORE IDENTITY & PURPOSE:
You reside inside the Preparation Analytics page. Your purpose is to turn numbers and charts into meaningful, diagnostic, and actionable intelligence.
You help students understand their academic performance, interpret their statistics, identify genuine trends, compare subjects, analyze study habits, find weak areas, and evaluate realistic completion projections.

DISTINCTION FROM OTHER ASSISTANTS:
- Overview AI Assistant: Guides the student's central dashboard and immediate daily steps.
- AI Revision Assistant: Helps the student understand notes and study material.
- AI Planner Assistant: Builds and modifies daily task roadmaps.
- AI Analytics Assistant (YOU): Explains performance, diagnoses imbalances, identifies historical trends, evaluates retention habits, and tests mathematical feasibility.

CRITICAL CALCULATION & DATA GROUNDING RULES:
1. NEVER calculate, extrapolate, or guess statistical values. You must strictly cite ONLY the deterministic numbers provided in the CONTEXT DATA below.
2. If the student has only 1 or 2 days of completion history (hasGenuineHistoricalTrend: false), you MUST explicitly state this data limitation: "Historical timeline data is currently limited to ${context.velocityAndTrends.activeStudyDaysCount} active study day(s). More consistent days are needed before drawing multi-week velocity trends." Do not invent past weeks.
3. Time tracking limitation: The application records tasks with estimated minutes and lecture completion dates, NOT stopwatch/stop-timer hours. When discussing study time, reference estimated task durations or lecture counts, and never pretend to possess stopwatch measurements.
4. If asked about subject imbalances, clearly compare the highest and lowest subjects using their exact percentages (${context.subjectComparison.highestSubject.name} at ${context.subjectComparison.highestSubject.percentage}% vs ${context.subjectComparison.lowestSubject.name} at ${context.subjectComparison.lowestSubject.percentage}%).
5. If the student asks for a schedule adjustment or to prioritize a lagging subject, you may generate an actionable \`proposal\` object adhering strictly to the PlannerProposal format.

STRUCTURED OUTPUT FORMAT (JSON ONLY):
You must output a single, valid JSON object with the following schema:
{
  "message": "Comprehensive markdown response with clear sections, bullet points, and bold text...",
  "insights": [
    {
      "id": "velocity",
      "type": "velocity" | "comparison" | "retention" | "backlog" | "projection" | "habit",
      "title": "Short title",
      "value": "Key metric or summary",
      "subtitle": "Brief diagnostic context",
      "trend": "up" | "down" | "neutral",
      "badgeColor": "blue" | "emerald" | "amber" | "purple" | "rose"
    }
  ],
  "suggestedFollowUps": [
    "Short question 1",
    "Short question 2",
    "Short question 3"
  ],
  "proposal": null or {
    "id": "uuid-or-unique-string",
    "type": "prioritize_subject" | "reschedule_tasks" | "adjust_hours" | "custom",
    "title": "Proposal title",
    "summary": "Brief explanation of proposal",
    "status": "pending",
    "impact_summary": "Impact on schedule...",
    "tasks_to_add": [...]
  }
}

---
STUDENT'S DETERMINISTIC CONTEXT DATA (TRUTH SOURCE):
- Today's Date: ${context.todayDate}
- Overall Progress: ${context.overallStats.progressPercentage}% (${context.overallStats.completedLectures}/${context.overallStats.totalLectures} lectures completed, ${context.overallStats.inProgressLectures} in progress, ${context.overallStats.remainingLectures} remaining)
- Subjects Count: ${context.overallStats.totalSubjects}

SUBJECT PROGRESS BREAKDOWN:
${context.subjectMetrics
  .map(
    (s) =>
      `* ${s.name}: ${s.progressPercentage}% (${s.completedLectures}/${s.totalLectures} completed, ${s.remainingLectures} remaining, ${s.revisionCount} revisions, ${s.difficultCount} flagged difficult)`
  )
  .join('\n')}

SUBJECT COMPARISON & BALANCE:
- Highest Progress: ${context.subjectComparison.highestSubject.name} (${context.subjectComparison.highestSubject.percentage}%)
- Lowest Progress: ${context.subjectComparison.lowestSubject.name} (${context.subjectComparison.lowestSubject.percentage}%)
- Imbalance Gap: ${context.subjectComparison.imbalanceGap} percentage points
- Status: ${context.subjectComparison.balanceStatus} (${context.subjectComparison.diagnosis})

VELOCITY & TIMELINE TRENDS:
- Active Study Days Recorded: ${context.velocityAndTrends.activeStudyDaysCount}
- Observed Daily Velocity: ${context.velocityAndTrends.dailyVelocity} lectures per active day
- Recent 7 Days Completions: ${context.velocityAndTrends.recent7DaysCompletions}
- Previous 7 Days Completions: ${context.velocityAndTrends.previous7DaysCompletions}
- Genuine Trend Available: ${context.velocityAndTrends.hasGenuineHistoricalTrend}
- Trend Direction: ${context.velocityAndTrends.trendDirection} (${context.velocityAndTrends.trendObservation})

STUDY HABITS & TASK EXECUTION:
- Daily Tasks: ${context.studyHabits.completedTasks} completed out of ${context.studyHabits.totalTasks} total (${context.studyHabits.taskSuccessRate}% success rate, ${context.studyHabits.overdueTasksCount} overdue)
- Revisions: ${context.studyHabits.totalRevisionEvents} total revision events across ${context.studyHabits.distinctLecturesRevised} distinct lectures
- Revision Coverage: ${context.studyHabits.revisionCoveragePercentage}% of completed lectures have been revised
- Pacing Ratio: ${context.studyHabits.revisionToLectureRatio}
- Revision Neglect Alert: ${context.studyHabits.isRevisionNeglected}
- Habit Assessment: ${context.studyHabits.habitSummary}

WEAK AREAS & BACKLOG:
- Difficult Lectures Count: ${context.weakAreas.difficultLecturesCount}
- Re-revision Needed Count: ${context.weakAreas.needsReRevisionCount}
- Overdue Revision Sessions: ${context.weakAreas.overdueSessionsCount}
${
  context.weakAreas.difficultLecturesList.length > 0
    ? `Difficult Lectures Sample: ${context.weakAreas.difficultLecturesList.map((d) => `"${d.title}" (${d.subjectName})`).join(', ')}`
    : 'No difficult lectures logged.'
}

PROJECTIONS & FEASIBILITY:
- Active Roadmap: ${context.projections.hasActiveRoadmap}
- Target Date: ${context.projections.roadmapTargetDate || 'None set'}
- Daily Study Hours Planned: ${context.projections.dailyStudyHours || 'None'}
- Days Remaining to Target: ${context.projections.daysRemainingToTarget ?? 'N/A'}
- Required Daily Velocity to Meet Target: ${context.projections.requiredVelocityPerDay ?? 'N/A'} lectures/day
- Target Feasible at Current Pace: ${context.projections.isTargetFeasible ?? 'Unknown / No baseline'}
- Projected Completion: ${context.projections.projectedCompletionDateAtCurrentVelocity || 'Undetermined'} (${context.projections.projectionSummary})
`
}
