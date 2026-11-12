import { createClient, getAuthenticatedUser } from '@/lib/supabase/server'
import { cache } from 'react'
import {
  Subject,
  Lecture,
  LectureProgress,
  SubjectWithStats,
  OverallStats,
  LectureWithProgress,
  LectureNote,
  GeneralNote,
  GeneralNoteWithSubject,
  RevisionSession,
  RevisionSessionWithDetails,
  SessionLectureWithDetails,
  LectureRevisionSummary,
  StudyTaskWithSubject,
} from '@/types/database'

const SUBJECT_ORDER: Record<string, number> = {
  'general-knowledge': 1,
  'english': 2,
  'mathematics': 3,
  'reasoning': 4,
}

/**
 * Cached per-request subjects getter.
 * The 4 JKSSB subjects are static course reference data.
 * Memoizing via React cache() eliminates repeated duplicate queries across layout, pages, and components.
 */
export const getCachedSubjects = cache(async (): Promise<Subject[]> => {
  const supabase = await createClient()
  const { data: subjects, error: subError } = await supabase
    .from('subjects')
    .select('*')
    .order('name')

  if (subError || !subjects) {
    throw new Error(`Failed to load subjects: ${subError?.message || 'Unknown error'}`)
  }

  return [...(subjects as Subject[])].sort((a, b) => {
    const orderA = SUBJECT_ORDER[a.slug] || 99
    const orderB = SUBJECT_ORDER[b.slug] || 99
    return orderA - orderB
  })
})

/**
 * Cached per-request subjects with lectures getter.
 * The 255-lecture catalogue is static reference data.
 * Memoizing via React cache() eliminates repeated joins across revision sessions and catalogues.
 */
export const getCachedSubjectsWithLectures = cache(async () => {
  const supabase = await createClient()
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('*, lectures(*)')
    .order('name')

  if (error || !subjects) {
    throw new Error(`Failed to load subjects with lectures: ${error?.message || 'Unknown error'}`)
  }

  return [...subjects]
    .sort((a, b) => {
      const orderA = SUBJECT_ORDER[a.slug] || 99
      const orderB = SUBJECT_ORDER[b.slug] || 99
      return orderA - orderB
    })
    .map((s) => ({
      ...s,
      lectures: ((s.lectures || []) as Lecture[]).sort((a, b) => a.lecture_number - b.lecture_number),
    }))
})

export async function getDashboardData() {
  const supabase = await createClient()

  // 1. Get authenticated user (memoized per-request)
  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  // 2. Fetch all subjects and user progress records in PARALLEL
  const [sortedSubjects, progressRes] = await Promise.all([
    getCachedSubjects(),
    supabase
      .from('lecture_progress')
      .select('status, lecture_id, completed_at, lectures!inner(subject_id)')
      .eq('user_id', user.id),
  ])

  if (progressRes.error) {
    throw new Error(`Failed to load progress: ${progressRes.error.message}`)
  }

  const progressRecords = progressRes.data || []

  // Map progress by lecture_id and by subject_id
  const progressByLectureId = new Map<string, LectureProgress>()
  const completedBySubjectId = new Map<string, number>()
  const inProgressBySubjectId = new Map<string, number>()

  for (const record of progressRecords) {
    progressByLectureId.set(record.lecture_id, record as unknown as LectureProgress)
    const subjectId = (record as unknown as { lectures: { subject_id: string } }).lectures?.subject_id

    if (subjectId) {
      if (record.status === 'completed') {
        completedBySubjectId.set(subjectId, (completedBySubjectId.get(subjectId) || 0) + 1)
      } else if (record.status === 'in_progress') {
        inProgressBySubjectId.set(subjectId, (inProgressBySubjectId.get(subjectId) || 0) + 1)
      }
    }
  }

  // Build subject-wise stats
  const subjectsWithStats: SubjectWithStats[] = sortedSubjects.map((subject) => {
    const completed = completedBySubjectId.get(subject.id) || 0
    const inProgress = inProgressBySubjectId.get(subject.id) || 0
    const total = subject.total_lectures
    const remaining = Math.max(0, total - completed)
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      ...subject,
      completed_count: completed,
      in_progress_count: inProgress,
      remaining_count: remaining,
      progress_percentage: percentage,
    }
  })

  // Calculate overall metrics
  const totalLectures = subjectsWithStats.reduce((acc, s) => acc + s.total_lectures, 0)
  const totalCompleted = subjectsWithStats.reduce((acc, s) => acc + s.completed_count, 0)
  const totalInProgress = subjectsWithStats.reduce((acc, s) => acc + s.in_progress_count, 0)
  const totalRemaining = Math.max(0, totalLectures - totalCompleted)
  const overallPercentage =
    totalLectures > 0 ? Math.round((totalCompleted / totalLectures) * 100) : 0

  const overallStats: OverallStats = {
    total_lectures: totalLectures,
    completed_count: totalCompleted,
    in_progress_count: totalInProgress,
    remaining_count: totalRemaining,
    progress_percentage: overallPercentage,
  }

  return {
    user,
    subjects: subjectsWithStats,
    overallStats,
    rawProgress: progressRecords,
  }
}

export async function getSubjectLectures(slug?: string) {
  const supabase = await createClient()

  // 1. Get authenticated user (memoized per-request)
  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  // 2. Get subjects (memoized per-request)
  const sortedSubjects = await getCachedSubjects()

  // Selected subject: default to first subject if slug not provided
  const activeSubject =
    sortedSubjects.find((s) => s.slug === slug) || sortedSubjects[0]

  // 3. Fetch lectures for active subject ordered numerically
  const { data: lectures, error: lecError } = await supabase
    .from('lectures')
    .select('id, subject_id, lecture_number, title')
    .eq('subject_id', activeSubject.id)
    .order('lecture_number', { ascending: true })

  if (lecError) {
    throw new Error(`Failed to load lectures: ${lecError.message}`)
  }

  // 4. Fetch user progress for this subject's lectures
  const lectureIds = (lectures || []).map((l) => l.id)
  const { data: progressList, error: progError } = await supabase
    .from('lecture_progress')
    .select('id, user_id, lecture_id, status, started_at, completed_at, updated_at')
    .eq('user_id', user.id)
    .in('lecture_id', lectureIds)

  if (progError) {
    throw new Error(`Failed to load progress: ${progError.message}`)
  }

  const progressMap = new Map<string, LectureProgress>()
  for (const p of progressList || []) {
    progressMap.set(p.lecture_id, p as LectureProgress)
  }

  const lecturesWithProgress: LectureWithProgress[] = (lectures as Lecture[]).map((lec) => ({
    ...lec,
    progress: progressMap.get(lec.id) || null,
  }))

  const completedCount = lecturesWithProgress.filter((l) => l.progress?.status === 'completed').length
  const inProgressCount = lecturesWithProgress.filter((l) => l.progress?.status === 'in_progress').length
  const total = activeSubject.total_lectures
  const remainingCount = Math.max(0, total - completedCount)
  const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0

  const activeSubjectStats: SubjectWithStats = {
    ...activeSubject,
    completed_count: completedCount,
    in_progress_count: inProgressCount,
    remaining_count: remainingCount,
    progress_percentage: percentage,
  }

  return {
    user,
    subjects: sortedSubjects,
    activeSubject: activeSubjectStats,
    lectures: lecturesWithProgress,
  }
}

/**
 * Comprehensive tracker data loader for instant, zero-latency subject switching.
 * Fetches all 4 subjects with all 255 lectures and the user's progress in ONE concurrent query,
 * eliminating all 3-second network roundtrips when toggling subjects on the client.
 */
export async function getTrackerData(initialSlug?: string) {
  const supabase = await createClient()

  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  const [sortedSubjects, progressRes] = await Promise.all([
    getCachedSubjectsWithLectures(),
    supabase
      .from('lecture_progress')
      .select('id, user_id, lecture_id, status, started_at, completed_at, updated_at')
      .eq('user_id', user.id),
  ])

  if (progressRes.error) {
    throw new Error(`Failed to load progress: ${progressRes.error.message}`)
  }

  const progressRecords = progressRes.data || []
  const progressMap = new Map<string, LectureProgress>()
  for (const p of progressRecords) {
    progressMap.set(p.lecture_id, p as LectureProgress)
  }

  const allLecturesBySubject: Record<string, LectureWithProgress[]> = {}
  const subjectsWithStats: SubjectWithStats[] = []

  let totalAllLectures = 0
  let totalAllCompleted = 0
  let totalAllInProgress = 0

  for (const sub of sortedSubjects) {
    const lecturesList = (sub.lectures || []) as Lecture[]
    const subLectures = lecturesList.map((lec: Lecture) => ({
      ...lec,
      progress: progressMap.get(lec.id) || null,
    }))

    allLecturesBySubject[sub.slug] = subLectures

    const completed = subLectures.filter((l: LectureWithProgress) => l.progress?.status === 'completed').length
    const inProgress = subLectures.filter((l: LectureWithProgress) => l.progress?.status === 'in_progress').length
    const total = sub.total_lectures
    const remaining = Math.max(0, total - completed)
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    totalAllLectures += total
    totalAllCompleted += completed
    totalAllInProgress += inProgress

    subjectsWithStats.push({
      ...sub,
      completed_count: completed,
      in_progress_count: inProgress,
      remaining_count: remaining,
      progress_percentage: percentage,
    })
  }

  const overallPercentage =
    totalAllLectures > 0 ? Math.round((totalAllCompleted / totalAllLectures) * 100) : 0

  const activeSubjectSlug =
    initialSlug && allLecturesBySubject[initialSlug]
      ? initialSlug
      : sortedSubjects[0]?.slug || 'general-knowledge'

  return {
    user,
    subjects: subjectsWithStats,
    allLecturesBySubject,
    overallPercentage,
    initialSubjectSlug: activeSubjectSlug,
  }
}

// --- PHASE 2: LECTURE NOTES & GENERAL NOTES QUERIES ---

export async function getLectureDetailsWithNote(lectureId: string) {
  const supabase = await createClient()

  // 1. Get authenticated user (memoized per-request)
  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  // 2. Fetch target lecture with its subject
  const { data: lecture, error: lecError } = await supabase
    .from('lectures')
    .select('*, subjects(*)')
    .eq('id', lectureId)
    .single()

  if (lecError || !lecture) {
    return null
  }

  const subject = lecture.subjects as unknown as Subject

  // 3. Fetch user progress, note, prev lecture, and next lecture concurrently in PARALLEL
  const [progRes, noteRes, prevRes, nextRes] = await Promise.all([
    supabase
      .from('lecture_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('lecture_id', lectureId)
      .maybeSingle(),
    supabase
      .from('lecture_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('lecture_id', lectureId)
      .maybeSingle(),
    supabase
      .from('lectures')
      .select('id, lecture_number, title')
      .eq('subject_id', subject.id)
      .lt('lecture_number', lecture.lecture_number)
      .order('lecture_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('lectures')
      .select('id, lecture_number, title')
      .eq('subject_id', subject.id)
      .gt('lecture_number', lecture.lecture_number)
      .order('lecture_number', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    user,
    lecture: lecture as Lecture,
    subject,
    progress: (progRes.data as LectureProgress) || null,
    note: (noteRes.data as LectureNote) || null,
    prevLecture: prevRes.data as { id: string; lecture_number: number; title: string } | null,
    nextLecture: nextRes.data as { id: string; lecture_number: number; title: string } | null,
  }
}

export async function getLectureNotesDirectory(initialSlug?: string) {
  const supabase = await createClient()

  // 1. Get authenticated user (memoized per-request)
  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  // 2. Fetch subjects with lectures, user progress, and lean notes metadata in PARALLEL
  const [sortedSubjects, progressRes, notesRes] = await Promise.all([
    getCachedSubjectsWithLectures(),
    supabase
      .from('lecture_progress')
      .select('lecture_id, status')
      .eq('user_id', user.id),
    supabase
      .from('lecture_notes')
      .select('id, lecture_id, plain_text, updated_at')
      .eq('user_id', user.id),
  ])

  const progressMap = new Map<string, string>()
  for (const p of progressRes.data || []) {
    progressMap.set(p.lecture_id, p.status)
  }

  const notesMap = new Map<string, any>()
  for (const n of notesRes.data || []) {
    notesMap.set(n.lecture_id, n)
  }

  const allLecturesBySubject: Record<string, (Lecture & { progress: LectureProgress | null; note: LectureNote | null })[]> = {}
  const notesCountBySubject: Record<string, number> = {}

  for (const sub of sortedSubjects) {
    const lecturesList = (sub.lectures || []) as Lecture[]
    const subLectures = lecturesList.map((lec: Lecture) => ({
      ...lec,
      progress: progressMap.has(lec.id)
        ? ({ status: progressMap.get(lec.id) } as LectureProgress)
        : null,
      note: (notesMap.get(lec.id) as unknown as LectureNote) || null,
    }))

    allLecturesBySubject[sub.slug] = subLectures
    notesCountBySubject[sub.slug] = subLectures.filter(
      (l) => l.note && (l.note.plain_text?.trim()?.length ?? 0) > 0
    ).length
  }

  const activeSubjectSlug =
    initialSlug && allLecturesBySubject[initialSlug]
      ? initialSlug
      : sortedSubjects[0]?.slug || 'general-knowledge'
  const activeSubject =
    sortedSubjects.find((s) => s.slug === activeSubjectSlug) || sortedSubjects[0]

  const activeLectures = allLecturesBySubject[activeSubjectSlug] || []
  const activeNotesCount = notesCountBySubject[activeSubjectSlug] || 0

  return {
    user,
    subjects: sortedSubjects,
    activeSubject,
    lectures: activeLectures,
    notesCount: activeNotesCount,
    totalLectures: activeSubject.total_lectures,
    allLecturesBySubject,
    notesCountBySubject,
    initialSubjectSlug: activeSubjectSlug,
  }
}

export async function getGeneralNotes(subjectFilter?: string, searchFilter?: string) {
  const supabase = await createClient()

  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  let query = supabase
    .from('general_notes')
    .select('id, user_id, subject_id, title, plain_text, updated_at, created_at, subjects(*)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (subjectFilter && subjectFilter !== 'all') {
    if (subjectFilter === 'uncategorized') {
      query = query.is('subject_id', null)
    } else {
      query = query.eq('subject_id', subjectFilter)
    }
  }

  // Fetch subjects and notes in parallel
  const [subjects, notesRes] = await Promise.all([
    getCachedSubjects(),
    query,
  ])

  if (notesRes.error) {
    throw new Error(`Failed to load general notes: ${notesRes.error.message}`)
  }

  let filteredNotes = (notesRes.data || []).map((n) => ({
    ...n,
    content: null,
    subject: (n as any).subjects as Subject | null,
  })) as unknown as GeneralNoteWithSubject[]

  if (searchFilter && searchFilter.trim()) {
    const q = searchFilter.toLowerCase().trim()
    filteredNotes = filteredNotes.filter((n) => {
      const titleMatch = n.title.toLowerCase().includes(q)
      const textMatch = n.plain_text?.toLowerCase().includes(q)
      return titleMatch || textMatch
    })
  }

  return {
    user,
    subjects,
    notes: filteredNotes,
  }
}

export async function getGeneralNoteById(noteId: string) {
  const supabase = await createClient()

  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  // Fetch note and subjects in parallel
  const [noteRes, subjects] = await Promise.all([
    supabase
      .from('general_notes')
      .select('*, subjects(*)')
      .eq('id', noteId)
      .eq('user_id', user.id)
      .single(),
    getCachedSubjects(),
  ])

  if (noteRes.error || !noteRes.data) {
    return null
  }

  const note = noteRes.data

  return {
    user,
    note: {
      ...note,
      subject: (note as any).subjects as Subject | null,
    } as GeneralNoteWithSubject,
    subjects,
  }
}

// --- PHASE 3: REVISION CENTRE & DAILY PLANNER QUERIES ---

export async function getRevisionHubData() {
  const supabase = await createClient()

  // 1. Get authenticated user (memoized per-request)
  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  // 2. Fetch subjects with lectures, user sessions, revision history, and user notes concurrently
  const [sortedSubjects, sessionsRes, historyRes, notesRes] = await Promise.all([
    getCachedSubjectsWithLectures(),
    supabase
      .from('revision_sessions')
      .select('*, subjects(*), revision_session_lectures(count, is_revised)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('revision_history')
      .select('*, lectures(*, subjects(*))')
      .eq('user_id', user.id)
      .order('revised_at', { ascending: false }),
    supabase
      .from('lecture_notes')
      .select('lecture_id, plain_text')
      .eq('user_id', user.id),
  ])

  const sessions = sessionsRes.data || []
  const historyRecords = historyRes.data || []
  const userNotes = notesRes.data || []

  const notesLectureIds = new Set(
    userNotes
      .filter((n) => (n.plain_text?.trim()?.length ?? 0) > 0)
      .map((n) => n.lecture_id)
  )

  // Aggregate revision history stats
  const lectureRevisionMap = new Map<string, {
    lecture: Lecture
    subject: Subject
    count: number
    lastRevised: string
    isDifficult: boolean
    needsReRevision: boolean
    nextDate: string | null
  }>()

  for (const h of historyRecords) {
    const lec = (h as any).lectures as (Lecture & { subjects: Subject })
    if (!lec) continue

    if (!lectureRevisionMap.has(lec.id)) {
      lectureRevisionMap.set(lec.id, {
        lecture: lec,
        subject: lec.subjects,
        count: 1,
        lastRevised: h.revised_at,
        isDifficult: h.is_difficult,
        needsReRevision: h.needs_re_revision,
        nextDate: h.next_revision_date,
      })
    } else {
      const existing = lectureRevisionMap.get(lec.id)!
      existing.count += 1
      if (h.is_difficult) existing.isDifficult = true
      if (h.needs_re_revision) existing.needsReRevision = true
      if (h.next_revision_date && (!existing.nextDate || h.next_revision_date > existing.nextDate)) {
        existing.nextDate = h.next_revision_date
      }
    }
  }

  const revisionSummaries: LectureRevisionSummary[] = Array.from(lectureRevisionMap.values()).map(
    (entry) => ({
      lecture: entry.lecture,
      subject: entry.subject,
      revision_count: entry.count,
      last_revised_at: entry.lastRevised,
      is_difficult: entry.isDifficult,
      needs_re_revision: entry.needsReRevision,
      next_revision_date: entry.nextDate,
      has_notes: notesLectureIds.has(entry.lecture.id),
    })
  )

  const difficultLectures = revisionSummaries.filter((s) => s.is_difficult)
  const needsReRevisionLectures = revisionSummaries.filter((s) => s.needs_re_revision)

  // Group scheduled sessions by date (Overdue, Due Today, Upcoming)
  const todayStr = new Date().toISOString().slice(0, 10)
  const scheduledSessions = sessions.filter((s) => s.status === 'scheduled')
  const overdueSessions = scheduledSessions.filter((s) => s.scheduled_date && s.scheduled_date < todayStr)
  const dueTodaySessions = scheduledSessions.filter((s) => s.scheduled_date === todayStr)
  const upcomingSessions = scheduledSessions.filter((s) => s.scheduled_date && s.scheduled_date > todayStr)
  const inProgressSessions = sessions.filter((s) => s.status === 'in_progress')
  const completedSessions = sessions.filter((s) => s.status === 'completed')

  return {
    user,
    subjects: sortedSubjects,
    notesLectureIds: Array.from(notesLectureIds),
    inProgressSessions,
    scheduledSessions: {
      overdue: overdueSessions,
      dueToday: dueTodaySessions,
      upcoming: upcomingSessions,
    },
    completedSessions: completedSessions.slice(0, 5),
    revisionSummaries,
    difficultLectures,
    needsReRevisionLectures,
    totalRevisedLectures: revisionSummaries.length,
    totalRevisionEvents: historyRecords.length,
  }
}

export async function getRevisionWorkspaceData(sessionId: string) {
  const supabase = await createClient()

  // 1. Get authenticated user (memoized per-request)
  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  // 2. Fetch revision session and session lectures in parallel
  const [sessRes, lecRes] = await Promise.all([
    supabase
      .from('revision_sessions')
      .select('*, subjects(*)')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('revision_session_lectures')
      .select('*, lectures(*, subjects(*))')
      .eq('session_id', sessionId)
      .order('order_index', { ascending: true }),
  ])

  if (sessRes.error || !sessRes.data) {
    return null
  }
  const session = sessRes.data

  if (lecRes.error || !lecRes.data) {
    throw new Error('Failed to load session lectures')
  }
  const sessionLectures = lecRes.data

  const lectureIds = sessionLectures.map((sl) => sl.lecture_id)

  // 3. Fetch original lecture notes (reusing original notes without copying)
  let notesList: any[] = []
  if (lectureIds.length > 0) {
    const { data: nList } = await supabase
      .from('lecture_notes')
      .select('*')
      .eq('user_id', user.id)
      .in('lecture_id', lectureIds)
    notesList = nList || []
  }

  const notesMap = new Map<string, LectureNote>()
  for (const n of notesList) {
    notesMap.set(n.lecture_id, n as LectureNote)
  }

  const lecturesWithDetails: SessionLectureWithDetails[] = sessionLectures.map((sl) => {
    const lec = (sl as any).lectures as (Lecture & { subjects: Subject })
    return {
      id: sl.id,
      session_id: sl.session_id,
      lecture_id: sl.lecture_id,
      order_index: sl.order_index,
      is_revised: sl.is_revised,
      is_difficult: sl.is_difficult,
      needs_re_revision: sl.needs_re_revision,
      revised_at: sl.revised_at,
      lecture: lec,
      subject: lec.subjects,
      note: notesMap.get(sl.lecture_id) || null,
    }
  })

  const total = lecturesWithDetails.length
  const revisedCount = lecturesWithDetails.filter((l) => l.is_revised).length
  const percentage = total > 0 ? Math.round((revisedCount / total) * 100) : 0

  const sessionDetails: RevisionSessionWithDetails = {
    ...session,
    subject: (session as any).subjects as Subject | null,
    lectures: lecturesWithDetails,
    total_lectures: total,
    revised_count: revisedCount,
    progress_percentage: percentage,
  }

  return {
    user,
    session: sessionDetails,
  }
}

export async function getDailyPlannerData(selectedDate?: string) {
  const supabase = await createClient()

  // 1. Get authenticated user (memoized per-request)
  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const activeDate = selectedDate || todayStr

  // 2. Fetch all subjects and all user tasks in parallel
  const [subjects, tasksRes] = await Promise.all([
    getCachedSubjects(),
    supabase
      .from('study_tasks')
      .select('*, subjects(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  if (tasksRes.error) {
    throw new Error(`Failed to load study tasks: ${tasksRes.error.message}`)
  }

  const allTasks: StudyTaskWithSubject[] = (tasksRes.data || []).map((t) => ({
    ...t,
    subject: (t as any).subjects as Subject | null,
  }))

  // Categorize tasks:
  const todayTasks = allTasks.filter((t) => t.scheduled_date === todayStr)
  const pendingPastTasks = allTasks.filter(
    (t) => t.scheduled_date < todayStr && t.status === 'pending'
  )
  const upcomingTasks = allTasks.filter(
    (t) => t.scheduled_date > todayStr && t.status === 'pending'
  )
  const completedTasks = allTasks.filter((t) => t.status === 'completed')

  return {
    user,
    activeDate,
    todayDate: todayStr,
    subjects: subjects || [],
    todayTasks,
    pendingPastTasks,
    upcomingTasks,
    completedTasks,
    totalCount: allTasks.length,
    todayCompletedCount: todayTasks.filter((t) => t.status === 'completed').length,
  }
}

// --- PHASE 4: ANALYTICS & COMPREHENSIVE DASHBOARD DATA ---

export async function getDashboardComprehensiveData() {
  const supabase = await createClient()

  // 1. Get authenticated user (memoized per-request)
  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  // 2. Fetch base dashboard metrics, today's tasks, scheduled revisions, and recent revision history in parallel
  const [baseData, tasksRes, scheduledRes, historyRes] = await Promise.all([
    getDashboardData(),
    supabase
      .from('study_tasks')
      .select('*, subjects(*)')
      .eq('user_id', user.id)
      .eq('scheduled_date', todayStr)
      .order('created_at', { ascending: false }),
    supabase
      .from('revision_sessions')
      .select('*, subjects(*)')
      .eq('user_id', user.id)
      .eq('status', 'scheduled'),
    supabase
      .from('revision_history')
      .select('*, lectures(*, subjects(*))')
      .eq('user_id', user.id)
      .order('revised_at', { ascending: false })
      .limit(5),
  ])

  if (!baseData) return null

  const todayTasks = (tasksRes.data || []).map((t) => ({
    ...t,
    subject: (t as any).subjects as Subject | null,
  })) as StudyTaskWithSubject[]

  const todayCompleted = todayTasks.filter((t) => t.status === 'completed').length

  const scheduled = scheduledRes.data || []
  const overdueRevisions = scheduled.filter((s) => s.scheduled_date && s.scheduled_date < todayStr)
  const dueTodayRevisions = scheduled.filter((s) => s.scheduled_date === todayStr)
  const upcomingRevisions = scheduled.filter((s) => s.scheduled_date && s.scheduled_date > todayStr)

  const recentRevisions = (historyRes.data || []).map((h) => ({
    id: h.id,
    lectureTitle: (h as any).lectures?.title || 'Lecture',
    subjectName: (h as any).lectures?.subjects?.name || 'Subject',
    revisedAt: h.revised_at,
    isDifficult: h.is_difficult,
  }))

  return {
    user,
    overallStats: baseData.overallStats,
    subjects: baseData.subjects,
    todayTasks,
    todayCompleted,
    todayTotal: todayTasks.length,
    revisions: {
      overdueCount: overdueRevisions.length,
      dueTodayCount: dueTodayRevisions.length,
      upcomingCount: upcomingRevisions.length,
      dueTodayList: dueTodayRevisions,
      recentRevisions,
    },
  }
}

export async function getAnalyticsData() {
  const supabase = await createClient()

  // 1. Get authenticated user (memoized per-request)
  const user = await getAuthenticatedUser()
  if (!user) {
    return null
  }

  // 2. Fetch base dashboard data, revision history, and tasks in parallel
  const [baseData, revHistoryRes, tasksRes] = await Promise.all([
    getDashboardData(),
    supabase
      .from('revision_history')
      .select('revised_at')
      .eq('user_id', user.id)
      .order('revised_at', { ascending: true }),
    supabase
      .from('study_tasks')
      .select('status, subject_id')
      .eq('user_id', user.id),
  ])

  if (!baseData) return null

  const { overallStats, subjects, rawProgress } = baseData

  // 3. Syllabus Donut Chart Data
  const unstartedCount = Math.max(
    0,
    overallStats.total_lectures - overallStats.completed_count - overallStats.in_progress_count
  )

  const syllabusDistribution = [
    { name: 'Completed', value: overallStats.completed_count, fill: '#10B981' },
    { name: 'In Progress', value: overallStats.in_progress_count, fill: '#F59E0B' },
    { name: 'Not Started', value: unstartedCount, fill: '#27272A' },
  ]

  // 4. Subject-wise Comparison Bar Chart Data
  const subjectComparison = subjects.map((s) => ({
    name: s.name,
    total: s.total_lectures,
    completed: s.completed_count,
    inProgress: s.in_progress_count,
    percentage: s.progress_percentage,
  }))

  // 5. Completed lectures timeline from already-fetched rawProgress (no redundant DB roundtrip!)
  const completedByDay = new Map<string, number>()
  for (const p of rawProgress || []) {
    if (p.status === 'completed' && p.completed_at) {
      const day = p.completed_at.slice(0, 10)
      completedByDay.set(day, (completedByDay.get(day) || 0) + 1)
    }
  }

  let cumulativeCompleted = 0
  const completionTimeline: { date: string; daily: number; cumulative: number }[] = []
  Array.from(completedByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, count]) => {
      cumulativeCompleted += count
      completionTimeline.push({
        date,
        daily: count,
        cumulative: cumulativeCompleted,
      })
    })

  // 6. Revision activity timeline from revision_history
  const revHistory = revHistoryRes.data || []
  const revisionByDay = new Map<string, number>()
  for (const r of revHistory) {
    if (r.revised_at) {
      const day = r.revised_at.slice(0, 10)
      revisionByDay.set(day, (revisionByDay.get(day) || 0) + 1)
    }
  }

  const revisionTimeline: { date: string; count: number }[] = []
  Array.from(revisionByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, count]) => {
      revisionTimeline.push({ date, count })
    })

  // 7. Study tasks statistics
  const allTasks = tasksRes.data || []
  const totalTasks = allTasks.length
  const completedTasks = allTasks.filter((t) => t.status === 'completed').length
  const pendingTasks = totalTasks - completedTasks

  const taskStats = [
    { name: 'Completed Tasks', value: completedTasks, fill: '#3B82F6' },
    { name: 'Pending Tasks', value: pendingTasks, fill: '#71717A' },
  ]

  return {
    user,
    overallStats,
    syllabusDistribution,
    subjectComparison,
    completionTimeline,
    revisionTimeline,
    totalRevisionEvents: revHistory.length,
    taskStats,
    totalTasks,
    completedTasks,
  }
}
