import { createClient } from '@/lib/supabase/server'
import {
  Subject,
  Lecture,
  SyllabusOverview,
  SubjectRoadmapItem,
  WeeklyMilestone,
  DailyScheduledDay,
  DailyScheduledTask,
  WeeklyReviewSummary,
} from '@/types/database'

export interface SubjectAnalysis {
  subject_id: string
  subject_name: string
  color: string
  total_lectures: number
  completed_lectures: number
  in_progress_lectures: number
  remaining_lectures: number
  progress_percentage: number
  difficult_lectures_count: number
  remaining_lectures_list: {
    id: string
    lecture_number: number
    title: string
  }[]
}

export interface SyllabusAnalysis {
  userId: string
  total_subjects: number
  total_lectures: number
  completed_lectures: number
  remaining_lectures: number
  overall_progress_percentage: number
  subjects: SubjectAnalysis[]
  difficult_topics: {
    lecture_id: string
    lecture_number: number
    lecture_title: string
    subject_name: string
  }[]
  existing_pending_tasks_count: number
}

/**
 * Extracts the student's actual database records and computes accurate syllabus metrics.
 * Runs queries in parallel for high performance.
 */
export async function analyzeStudentSyllabus(userId: string): Promise<SyllabusAnalysis> {
  const supabase = await createClient()

  // 1. Fetch subjects, lectures, progress, difficult revisions, and existing tasks in parallel
  const [subjectsRes, lecturesRes, progressRes, difficultRevisionsRes, tasksRes] = await Promise.all([
    supabase
      .from('subjects')
      .select('*')
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
      .from('revision_history')
      .select('lecture_id, is_difficult, needs_re_revision')
      .eq('user_id', userId)
      .or('is_difficult.eq.true,needs_re_revision.eq.true'),

    supabase
      .from('study_tasks')
      .select('id, status')
      .eq('user_id', userId)
      .eq('status', 'pending'),
  ])

  if (subjectsRes.error) {
    throw new Error(`Failed to load subjects: ${subjectsRes.error.message}`)
  }

  const subjects = (subjectsRes.data || []) as Subject[]
  const allLectures = (lecturesRes.data || []) as Lecture[]
  const progressList = (progressRes.data || []) as { lecture_id: string; status: string }[]
  const difficultRevisions = (difficultRevisionsRes.data || []) as { lecture_id: string }[]

  // Progress Map
  const progressMap = new Map<string, string>()
  for (const p of progressList) {
    progressMap.set(p.lecture_id, p.status)
  }

  // Difficult Lecture IDs Set
  const difficultSet = new Set<string>()
  for (const d of difficultRevisions) {
    difficultSet.add(d.lecture_id)
  }

  // Map Lectures by Subject
  const lecturesBySubject = new Map<string, Lecture[]>()
  for (const lec of allLectures) {
    if (!lecturesBySubject.has(lec.subject_id)) {
      lecturesBySubject.set(lec.subject_id, [])
    }
    lecturesBySubject.get(lec.subject_id)!.push(lec)
  }

  let totalLecturesCount = 0
  let totalCompletedCount = 0
  const difficultTopicsList: SyllabusAnalysis['difficult_topics'] = []

  const subjectAnalyses: SubjectAnalysis[] = subjects.map((subj) => {
    const subjectLectures = lecturesBySubject.get(subj.id) || []
    let completed = 0
    let inProgress = 0
    const remainingList: SubjectAnalysis['remaining_lectures_list'] = []

    for (const lec of subjectLectures) {
      const status = progressMap.get(lec.id)
      if (status === 'completed') {
        completed++
      } else {
        if (status === 'in_progress') inProgress++
        remainingList.push({
          id: lec.id,
          lecture_number: lec.lecture_number,
          title: lec.title,
        })
      }

      if (difficultSet.has(lec.id)) {
        difficultTopicsList.push({
          lecture_id: lec.id,
          lecture_number: lec.lecture_number,
          lecture_title: lec.title,
          subject_name: subj.name,
        })
      }
    }

    const total = subj.total_lectures || subjectLectures.length
    const remaining = Math.max(0, total - completed)
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0

    totalLecturesCount += total
    totalCompletedCount += completed

    return {
      subject_id: subj.id,
      subject_name: subj.name,
      color: subj.color || '#8B5CF6',
      total_lectures: total,
      completed_lectures: completed,
      in_progress_lectures: inProgress,
      remaining_lectures: remaining,
      progress_percentage: pct,
      difficult_lectures_count: subjectLectures.filter((l) => difficultSet.has(l.id)).length,
      remaining_lectures_list: remainingList,
    }
  })

  const totalRemainingCount = Math.max(0, totalLecturesCount - totalCompletedCount)
  const overallPercentage =
    totalLecturesCount > 0 ? Math.round((totalCompletedCount / totalLecturesCount) * 100) : 0

  return {
    userId,
    total_subjects: subjects.length,
    total_lectures: totalLecturesCount,
    completed_lectures: totalCompletedCount,
    remaining_lectures: totalRemainingCount,
    overall_progress_percentage: overallPercentage,
    subjects: subjectAnalyses,
    difficult_topics: difficultTopicsList,
    existing_pending_tasks_count: tasksRes.data?.length || 0,
  }
}

/**
 * Calculates mathematical study capacity, estimated weeks, and feasibility.
 */
export function calculateStudyCapacity(
  analysis: SyllabusAnalysis,
  dailyStudyHours: number,
  unavailableDays: string[] = [],
  targetDate?: string | null
): SyllabusOverview {
  const studyDaysPerWeek = Math.max(1, 7 - (unavailableDays?.length || 0))
  const weeklyCapacityHours = studyDaysPerWeek * dailyStudyHours

  // Standard study model: Each remaining lecture requires ~1.5 hours of total effort:
  // 50m lecture intake/notes + 25m practice/recall + 15m spaced revision cushion
  const totalEffortHours = Math.round(analysis.remaining_lectures * 1.5)

  // Estimated weeks needed to complete remaining syllabus
  const estimatedWeeksNeeded =
    weeklyCapacityHours > 0
      ? Math.max(1, Math.ceil(totalEffortHours / weeklyCapacityHours))
      : 1
  const estimatedDaysNeeded = estimatedWeeksNeeded * 7

  const today = new Date()
  const estCompletionDateObj = new Date(today.getTime() + estimatedDaysNeeded * 24 * 60 * 60 * 1000)
  const estimatedCompletionDate = estCompletionDateObj.toISOString().slice(0, 10)

  // Target Date Feasibility Calculation
  let targetDateFeasible = true
  let feasibilityExplanation = 'Paced realistically according to your available daily hours.'

  if (targetDate) {
    const targetDateObj = new Date(targetDate)
    const diffMs = targetDateObj.getTime() - today.getTime()
    const availableCalendarDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    const availableStudyDays = Math.max(1, Math.floor(availableCalendarDays * (studyDaysPerWeek / 7)))
    const totalAvailableHours = availableStudyDays * dailyStudyHours

    targetDateFeasible = totalAvailableHours >= totalEffortHours

    const requiredDailyHours = (totalEffortHours / availableStudyDays).toFixed(1)

    if (targetDateFeasible) {
      const bufferHours = Math.round(totalAvailableHours - totalEffortHours)
      feasibilityExplanation = `Realistic and achievable! At ${dailyStudyHours}h/day across ${studyDaysPerWeek} study days/week, you will complete the syllabus by ${estimatedCompletionDate}, leaving ~${bufferHours} buffer hours for full mock tests before your exam date (${targetDate}).`
    } else {
      feasibilityExplanation = `Ambitious target date. To finish all ${analysis.remaining_lectures} remaining lectures by ${targetDate}, you would need approximately ${requiredDailyHours} hours/day (vs your selected ${dailyStudyHours}h/day). We have prioritized high-yield core lectures, but consider extending your target date by ${Math.ceil((totalEffortHours - totalAvailableHours) / dailyStudyHours)} days or increasing daily study hours.`
    }
  }

  const workloadSummary = `${analysis.remaining_lectures} remaining lectures requiring ~${totalEffortHours} total study hours at ${dailyStudyHours}h/day (${weeklyCapacityHours.toFixed(1)}h/week).`

  return {
    total_subjects: analysis.total_subjects,
    total_lectures: analysis.total_lectures,
    completed_lectures: analysis.completed_lectures,
    remaining_lectures: analysis.remaining_lectures,
    overall_progress_percentage: analysis.overall_progress_percentage,
    daily_study_hours: dailyStudyHours,
    study_days_per_week: studyDaysPerWeek,
    estimated_days_needed: estimatedDaysNeeded,
    estimated_weeks_needed: estimatedWeeksNeeded,
    estimated_completion_date: estimatedCompletionDate,
    target_date: targetDate || null,
    target_date_feasible: targetDateFeasible,
    feasibility_explanation: feasibilityExplanation,
    workload_summary: workloadSummary,
  }
}

/**
 * Builds the deterministic schedule binding Gemini's strategic guidelines to actual database records.
 * Ensures zero hallucination: only real lecture IDs and titles are scheduled.
 */
export function buildDeterministicRoadmap(
  analysis: SyllabusAnalysis,
  overview: SyllabusOverview,
  geminiStrategies: {
    subject_priorities?: { subject_id: string; priority: 'high' | 'medium' | 'low'; strategy: string; practice_advice: string }[]
    weekly_guidance?: string[]
  },
  unavailableDays: string[] = []
): {
  subject_roadmaps: SubjectRoadmapItem[]
  weekly_milestones: WeeklyMilestone[]
  daily_schedule: DailyScheduledDay[]
  weekly_review: WeeklyReviewSummary
} {
  const unavailableDaysSet = new Set(unavailableDays.map((d) => d.toLowerCase()))
  const priorityMap = new Map<string, { priority: 'high' | 'medium' | 'low'; strategy: string; practice_advice: string }>()

  for (const sp of geminiStrategies.subject_priorities || []) {
    priorityMap.set(sp.subject_id, {
      priority: sp.priority || 'medium',
      strategy: sp.strategy || 'Follow standard study and practice rhythm.',
      practice_advice: sp.practice_advice || 'Solve end-of-lecture practice questions.',
    })
  }

  // 1. Build Subject Roadmaps
  const subjectRoadmaps: SubjectRoadmapItem[] = analysis.subjects.map((subj) => {
    const strat = priorityMap.get(subj.subject_id) || {
      priority: subj.remaining_lectures > 25 ? 'high' : 'medium',
      strategy: 'Focus on regular lecture intake paired with active recall.',
      practice_advice: 'Complete topic-wise exercises after each lecture.',
    }

    // Weekly target: distribute remaining lectures over estimated weeks
    const weeklyTarget =
      overview.estimated_weeks_needed > 0
        ? Math.max(1, Math.ceil(subj.remaining_lectures / overview.estimated_weeks_needed))
        : Math.min(subj.remaining_lectures, 4)

    return {
      subject_id: subj.subject_id,
      subject_name: subj.subject_name,
      total_lectures: subj.total_lectures,
      completed_lectures: subj.completed_lectures,
      remaining_lectures: subj.remaining_lectures,
      progress_percentage: subj.progress_percentage,
      weekly_lecture_target: weeklyTarget,
      priority: strat.priority,
      recommended_strategy: strat.strategy,
      practice_advice: strat.practice_advice,
      revision_frequency: subj.difficult_lectures_count > 0 ? 'Twice weekly (High focus)' : 'Once weekly',
    }
  })

  // 2. Generate 14-day detailed Daily Schedule and Weekly Milestones
  // We schedule realistic days (using actual uncompleted lectures from remaining_lectures_list)
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dailySchedule: DailyScheduledDay[] = []

  // Subject lecture pointers to progress linearly through actual uncompleted lectures
  const lecturePointers = new Map<string, number>()
  for (const s of analysis.subjects) {
    lecturePointers.set(s.subject_id, 0)
  }

  // Available subjects with remaining lectures (sorted by priority: high -> medium -> low)
  const activeSubjects = [...analysis.subjects]
    .filter((s) => s.remaining_lectures > 0)
    .sort((a, b) => {
      const pA = priorityMap.get(a.subject_id)?.priority || 'medium'
      const pB = priorityMap.get(b.subject_id)?.priority || 'medium'
      const weight = { high: 3, medium: 2, low: 1 }
      return weight[pB] - weight[pA]
    })

  const today = new Date()
  const scheduleDaysCount = 14 // Generate 2 weeks of granular daily tasks
  let activeSubjectIndex = 0

  for (let i = 0; i < scheduleDaysCount; i++) {
    const curDate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
    const dateStr = curDate.toISOString().slice(0, 10)
    const dayName = daysOfWeek[curDate.getDay()]
    const isOffDay = unavailableDaysSet.has(dayName.toLowerCase())

    const dayTasks: DailyScheduledTask[] = []
    let dayMinutes = 0

    if (isOffDay) {
      dailySchedule.push({
        date: dateStr,
        day_name: dayName,
        is_off_day: true,
        total_minutes: 0,
        tasks: [],
      })
      continue
    }

    const dailyBudgetMinutes = Math.round(overview.daily_study_hours * 60)

    // Schedule 1 or 2 subjects per day (interleaved learning)
    const subjectsToPick = activeSubjects.length > 0 ? (dailyBudgetMinutes >= 150 ? 2 : 1) : 0

    for (let sIdx = 0; sIdx < subjectsToPick; sIdx++) {
      if (activeSubjects.length === 0) break
      const subj = activeSubjects[(activeSubjectIndex + sIdx) % activeSubjects.length]
      const ptr = lecturePointers.get(subj.subject_id) || 0
      const nextLec = subj.remaining_lectures_list[ptr]

      if (nextLec) {
        // Lecture Task
        const lecDuration = Math.min(50, Math.floor(dailyBudgetMinutes * 0.55))
        dayTasks.push({
          id: `task_${dateStr}_${subj.subject_id}_lec_${nextLec.lecture_number}`,
          subject_id: subj.subject_id,
          subject_name: subj.subject_name,
          lecture_id: nextLec.id,
          lecture_number: nextLec.lecture_number,
          lecture_title: nextLec.title,
          task_title: `${subj.subject_name}: Lecture ${nextLec.lecture_number} — ${nextLec.title}`,
          task_type: 'lecture',
          estimated_minutes: lecDuration,
          priority: 'high',
          status: 'pending',
        })
        dayMinutes += lecDuration
        lecturePointers.set(subj.subject_id, ptr + 1)

        // Practice Task
        const practiceDuration = Math.min(30, Math.max(20, Math.floor(dailyBudgetMinutes * 0.25)))
        dayTasks.push({
          id: `task_${dateStr}_${subj.subject_id}_prac_${nextLec.lecture_number}`,
          subject_id: subj.subject_id,
          subject_name: subj.subject_name,
          lecture_id: nextLec.id,
          lecture_number: nextLec.lecture_number,
          lecture_title: nextLec.title,
          task_title: `${subj.subject_name}: Practice & Notes consolidation for Lec ${nextLec.lecture_number}`,
          task_type: 'practice',
          estimated_minutes: practiceDuration,
          priority: 'medium',
          status: 'pending',
        })
        dayMinutes += practiceDuration
      }
    }

    // Add spaced recall / revision task if remaining time allows
    const remainingTime = dailyBudgetMinutes - dayMinutes
    if (remainingTime >= 20) {
      // Pick a difficult topic or previous lecture for active recall
      const difficultTopic = analysis.difficult_topics[i % Math.max(1, analysis.difficult_topics.length)]
      const recallTitle = difficultTopic
        ? `Active Recall & Revision: ${difficultTopic.subject_name} Lec ${difficultTopic.lecture_number} (${difficultTopic.lecture_title})`
        : `Spaced Revision: Flashcards & Key Points review`

      dayTasks.push({
        id: `task_${dateStr}_rev_${i}`,
        subject_id: difficultTopic ? activeSubjects[0]?.subject_id || '' : '',
        subject_name: difficultTopic ? difficultTopic.subject_name : 'Revision Centre',
        lecture_id: difficultTopic?.lecture_id || null,
        lecture_number: difficultTopic?.lecture_number || null,
        lecture_title: difficultTopic?.lecture_title || null,
        task_title: recallTitle,
        task_type: 'recall',
        estimated_minutes: remainingTime,
        priority: 'medium',
        status: 'pending',
      })
      dayMinutes += remainingTime
    }

    // Rotate primary subject pointer for next study day
    activeSubjectIndex = (activeSubjectIndex + 1) % Math.max(1, activeSubjects.length)

    dailySchedule.push({
      date: dateStr,
      day_name: dayName,
      is_off_day: false,
      total_minutes: dayMinutes,
      tasks: dayTasks,
    })
  }

  // 3. Build Weekly Milestones (Week 1 and Week 2)
  const weeklyMilestones: WeeklyMilestone[] = [
    {
      week_number: 1,
      week_label: 'Week 1: Core Acceleration & Momentum',
      start_date: today.toISOString().slice(0, 10),
      end_date: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      subject_targets: subjectRoadmaps.map((sr) => ({
        subject_id: sr.subject_id,
        subject_name: sr.subject_name,
        target_lectures_count: sr.weekly_lecture_target,
        lecture_range: `Next ${sr.weekly_lecture_target} uncompleted lectures`,
      })),
      practice_goals: [
        'Complete end-of-lecture practice questions on the same day as lecture intake.',
        'Record difficult concepts in Revision Centre for active recall.',
      ],
      revision_goals: [
        'Weekly active recall check on all lectures completed this week.',
        'Review flashcards for difficult formulas or dates.',
      ],
      expected_cumulative_progress: Math.min(
        100,
        analysis.overall_progress_percentage +
          Math.round((subjectRoadmaps.reduce((acc, s) => acc + s.weekly_lecture_target, 0) / Math.max(1, analysis.total_lectures)) * 100)
      ),
      catchup_day: unavailableDays.length > 0 ? unavailableDays[0] : 'Sunday Afternoon',
    },
    {
      week_number: 2,
      week_label: 'Week 2: Deep Learning & Knowledge Consolidation',
      start_date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      end_date: new Date(today.getTime() + 13 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      subject_targets: subjectRoadmaps.map((sr) => ({
        subject_id: sr.subject_id,
        subject_name: sr.subject_name,
        target_lectures_count: sr.weekly_lecture_target,
        lecture_range: `Subsequent ${sr.weekly_lecture_target} lectures`,
      })),
      practice_goals: [
        'Mixed-topic problem solving across completed modules.',
        'Timed practice test for highest-priority subject.',
      ],
      revision_goals: [
        'Targeted re-revision of all topics marked needs_re_revision in Revision Centre.',
        'Active recall evaluation test before starting next subject tier.',
      ],
      expected_cumulative_progress: Math.min(
        100,
        analysis.overall_progress_percentage +
          Math.round((subjectRoadmaps.reduce((acc, s) => acc + s.weekly_lecture_target * 2, 0) / Math.max(1, analysis.total_lectures)) * 100)
      ),
      catchup_day: unavailableDays.length > 0 ? unavailableDays[0] : 'Sunday Afternoon',
    },
  ]

  // 4. Initial Weekly Review Placeholder
  const weeklyReview: WeeklyReviewSummary = {
    planned_lectures: subjectRoadmaps.reduce((acc, s) => acc + s.weekly_lecture_target, 0),
    completed_lectures: 0,
    completion_rate_percentage: 0,
    subject_progress: subjectRoadmaps.map((s) => ({
      subject_id: s.subject_id,
      subject_name: s.subject_name,
      completed: 0,
      total_planned: s.weekly_lecture_target,
    })),
    pending_tasks_count: dailySchedule.reduce((acc, d) => acc + d.tasks.length, 0),
    catchup_recommendations:
      'Roadmap newly initialized. Check off daily study tasks as you complete lectures to track your weekly adherence.',
    next_week_priorities: subjectRoadmaps
      .filter((s) => s.priority === 'high')
      .map((s) => `Stay consistent on ${s.subject_name} target of ${s.weekly_lecture_target} lectures/week.`),
  }

  return {
    subject_roadmaps: subjectRoadmaps,
    weekly_milestones: weeklyMilestones,
    daily_schedule: dailySchedule,
    weekly_review: weeklyReview,
  }
}
