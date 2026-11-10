import { createClient } from '@/lib/supabase/server'
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

export async function getDashboardData() {
  const supabase = await createClient()

  // 1. Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  // 2. Fetch all subjects
  const { data: subjects, error: subError } = await supabase
    .from('subjects')
    .select('*')
    .order('name')

  if (subError || !subjects) {
    throw new Error(`Failed to load subjects: ${subError?.message || 'Unknown error'}`)
  }

  // Desired ordering: General Knowledge, English, Mathematics, Reasoning
  const subjectOrder: Record<string, number> = {
    'general-knowledge': 1,
    'english': 2,
    'mathematics': 3,
    'reasoning': 4,
  }

  const sortedSubjects = [...(subjects as Subject[])].sort((a, b) => {
    const orderA = subjectOrder[a.slug] || 99
    const orderB = subjectOrder[b.slug] || 99
    return orderA - orderB
  })

  // 3. Fetch all progress records for current user
  const { data: progressRecords, error: progError } = await supabase
    .from('lecture_progress')
    .select('*, lectures!inner(subject_id)')
    .eq('user_id', user.id)

  if (progError) {
    throw new Error(`Failed to load progress: ${progError.message}`)
  }

  // Map progress by lecture_id and by subject_id
  const progressByLectureId = new Map<string, LectureProgress>()
  const completedBySubjectId = new Map<string, number>()
  const inProgressBySubjectId = new Map<string, number>()

  for (const record of progressRecords || []) {
    progressByLectureId.set(record.lecture_id, record as LectureProgress)
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
  }
}

export async function getSubjectLectures(slug?: string) {
  const supabase = await createClient()

  // 1. Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  // 2. Fetch subjects
  const { data: subjects, error: subError } = await supabase
    .from('subjects')
    .select('*')

  if (subError || !subjects || subjects.length === 0) {
    throw new Error('Subjects not found in database.')
  }

  const subjectOrder: Record<string, number> = {
    'general-knowledge': 1,
    'english': 2,
    'mathematics': 3,
    'reasoning': 4,
  }

  const sortedSubjects = [...(subjects as Subject[])].sort((a, b) => {
    const orderA = subjectOrder[a.slug] || 99
    const orderB = subjectOrder[b.slug] || 99
    return orderA - orderB
  })

  // Selected subject: default to first subject if slug not provided
  const activeSubject =
    sortedSubjects.find((s) => s.slug === slug) || sortedSubjects[0]

  // 3. Fetch lectures for active subject ordered numerically
  const { data: lectures, error: lecError } = await supabase
    .from('lectures')
    .select('*')
    .eq('subject_id', activeSubject.id)
    .order('lecture_number', { ascending: true })

  if (lecError) {
    throw new Error(`Failed to load lectures: ${lecError.message}`)
  }

  // 4. Fetch user progress for this subject's lectures
  const lectureIds = (lectures || []).map((l) => l.id)
  const { data: progressList, error: progError } = await supabase
    .from('lecture_progress')
    .select('*')
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

// --- PHASE 2: LECTURE NOTES & GENERAL NOTES QUERIES ---

export async function getLectureDetailsWithNote(lectureId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data: lecture, error: lecError } = await supabase
    .from('lectures')
    .select('*, subjects(*)')
    .eq('id', lectureId)
    .single()

  if (lecError || !lecture) {
    return null
  }

  const subject = lecture.subjects as unknown as Subject

  const { data: progress } = await supabase
    .from('lecture_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('lecture_id', lectureId)
    .maybeSingle()

  const { data: note } = await supabase
    .from('lecture_notes')
    .select('*')
    .eq('user_id', user.id)
    .eq('lecture_id', lectureId)
    .maybeSingle()

  const { data: prevLecture } = await supabase
    .from('lectures')
    .select('id, lecture_number, title')
    .eq('subject_id', subject.id)
    .lt('lecture_number', lecture.lecture_number)
    .order('lecture_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: nextLecture } = await supabase
    .from('lectures')
    .select('id, lecture_number, title')
    .eq('subject_id', subject.id)
    .gt('lecture_number', lecture.lecture_number)
    .order('lecture_number', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    user,
    lecture: lecture as Lecture,
    subject,
    progress: (progress as LectureProgress) || null,
    note: (note as LectureNote) || null,
    prevLecture: prevLecture as { id: string; lecture_number: number; title: string } | null,
    nextLecture: nextLecture as { id: string; lecture_number: number; title: string } | null,
  }
}

export async function getLectureNotesDirectory(slug?: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data: subjects, error: subError } = await supabase
    .from('subjects')
    .select('*')

  if (subError || !subjects) {
    throw new Error('Failed to load subjects')
  }

  const subjectOrder: Record<string, number> = {
    'general-knowledge': 1,
    'english': 2,
    'mathematics': 3,
    'reasoning': 4,
  }

  const sortedSubjects = [...(subjects as Subject[])].sort((a, b) => {
    const orderA = subjectOrder[a.slug] || 99
    const orderB = subjectOrder[b.slug] || 99
    return orderA - orderB
  })

  const activeSubject = sortedSubjects.find((s) => s.slug === slug) || sortedSubjects[0]

  const { data: lectures, error: lecError } = await supabase
    .from('lectures')
    .select('*')
    .eq('subject_id', activeSubject.id)
    .order('lecture_number', { ascending: true })

  if (lecError) {
    throw new Error('Failed to load lectures')
  }

  const lectureIds = (lectures || []).map((l) => l.id)

  const { data: progressList } = await supabase
    .from('lecture_progress')
    .select('*')
    .eq('user_id', user.id)
    .in('lecture_id', lectureIds)

  const progressMap = new Map<string, LectureProgress>()
  for (const p of progressList || []) {
    progressMap.set(p.lecture_id, p as LectureProgress)
  }

  const { data: notesList } = await supabase
    .from('lecture_notes')
    .select('*')
    .eq('user_id', user.id)
    .in('lecture_id', lectureIds)

  const notesMap = new Map<string, LectureNote>()
  for (const n of notesList || []) {
    notesMap.set(n.lecture_id, n as LectureNote)
  }

  const lecturesWithDetails = (lectures as Lecture[]).map((lec) => ({
    ...lec,
    progress: progressMap.get(lec.id) || null,
    note: notesMap.get(lec.id) || null,
  }))

  const notesCount = lecturesWithDetails.filter(
    (l) => l.note && (l.note.plain_text?.trim()?.length ?? 0) > 0
  ).length

  return {
    user,
    subjects: sortedSubjects,
    activeSubject,
    lectures: lecturesWithDetails,
    notesCount,
    totalLectures: activeSubject.total_lectures,
  }
}

export async function getGeneralNotes(subjectFilter?: string, searchFilter?: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data: subjects } = await supabase
    .from('subjects')
    .select('*')
    .order('name')

  let query = supabase
    .from('general_notes')
    .select('*, subjects(*)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (subjectFilter && subjectFilter !== 'all') {
    if (subjectFilter === 'uncategorized') {
      query = query.is('subject_id', null)
    } else {
      query = query.eq('subject_id', subjectFilter)
    }
  }

  const { data: notes, error: notesError } = await query

  if (notesError) {
    throw new Error(`Failed to load general notes: ${notesError.message}`)
  }

  let filteredNotes = (notes || []).map((n) => ({
    ...n,
    subject: (n as any).subjects as Subject | null,
  })) as GeneralNoteWithSubject[]

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
    subjects: (subjects as Subject[]) || [],
    notes: filteredNotes,
  }
}

export async function getGeneralNoteById(noteId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const { data: note, error: noteError } = await supabase
    .from('general_notes')
    .select('*, subjects(*)')
    .eq('id', noteId)
    .eq('user_id', user.id)
    .single()

  if (noteError || !note) {
    return null
  }

  const { data: subjects } = await supabase
    .from('subjects')
    .select('*')
    .order('name')

  return {
    user,
    note: {
      ...note,
      subject: (note as any).subjects as Subject | null,
    } as GeneralNoteWithSubject,
    subjects: (subjects as Subject[]) || [],
  }
}

// --- PHASE 3: REVISION CENTRE & DAILY PLANNER QUERIES ---

export async function getRevisionHubData() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  // 1. Fetch all subjects with all lectures (for session creation)
  const { data: subjects } = await supabase
    .from('subjects')
    .select('*, lectures(*)')
    .order('name')

  const subjectOrder: Record<string, number> = {
    'general-knowledge': 1,
    'english': 2,
    'mathematics': 3,
    'reasoning': 4,
  }

  const sortedSubjects = [...(subjects || [])].sort((a, b) => {
    const orderA = subjectOrder[a.slug] || 99
    const orderB = subjectOrder[b.slug] || 99
    return orderA - orderB
  }).map((s) => ({
    ...s,
    lectures: (s.lectures as Lecture[]).sort((a, b) => a.lecture_number - b.lecture_number),
  }))

  // 2. Fetch active and scheduled revision sessions
  const { data: sessions } = await supabase
    .from('revision_sessions')
    .select('*, subjects(*), revision_session_lectures(count, is_revised)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  // 3. Fetch revision history summary per lecture
  const { data: historyRecords } = await supabase
    .from('revision_history')
    .select('*, lectures(*, subjects(*))')
    .eq('user_id', user.id)
    .order('revised_at', { ascending: false })

  // 4. Also fetch user's lecture notes to know which lectures have notes
  const { data: userNotes } = await supabase
    .from('lecture_notes')
    .select('lecture_id, plain_text')
    .eq('user_id', user.id)

  const notesLectureIds = new Set(
    (userNotes || [])
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

  for (const h of historyRecords || []) {
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
  const scheduledSessions = (sessions || []).filter((s) => s.status === 'scheduled')
  const overdueSessions = scheduledSessions.filter((s) => s.scheduled_date && s.scheduled_date < todayStr)
  const dueTodaySessions = scheduledSessions.filter((s) => s.scheduled_date === todayStr)
  const upcomingSessions = scheduledSessions.filter((s) => s.scheduled_date && s.scheduled_date > todayStr)
  const inProgressSessions = (sessions || []).filter((s) => s.status === 'in_progress')
  const completedSessions = (sessions || []).filter((s) => s.status === 'completed')

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
    totalRevisionEvents: (historyRecords || []).length,
  }
}

export async function getRevisionWorkspaceData(sessionId: string) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  // 1. Fetch revision session
  const { data: session, error: sessErr } = await supabase
    .from('revision_sessions')
    .select('*, subjects(*)')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (sessErr || !session) {
    return null
  }

  // 2. Fetch session lectures with lecture details and subject
  const { data: sessionLectures, error: lecErr } = await supabase
    .from('revision_session_lectures')
    .select('*, lectures(*, subjects(*))')
    .eq('session_id', sessionId)
    .order('order_index', { ascending: true })

  if (lecErr || !sessionLectures) {
    throw new Error('Failed to load session lectures')
  }

  const lectureIds = sessionLectures.map((sl) => sl.lecture_id)

  // 3. Fetch original lecture notes (reusing original notes without copying)
  const { data: notesList } = await supabase
    .from('lecture_notes')
    .select('*')
    .eq('user_id', user.id)
    .in('lecture_id', lectureIds)

  const notesMap = new Map<string, LectureNote>()
  for (const n of notesList || []) {
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const activeDate = selectedDate || todayStr

  // 1. Fetch all subjects for category selector
  const { data: subjects } = await supabase
    .from('subjects')
    .select('*')
    .order('name')

  // 2. Fetch all user tasks
  const { data: tasks, error: tasksErr } = await supabase
    .from('study_tasks')
    .select('*, subjects(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (tasksErr) {
    throw new Error(`Failed to load study tasks: ${tasksErr.message}`)
  }

  const allTasks: StudyTaskWithSubject[] = (tasks || []).map((t) => ({
    ...t,
    subject: (t as any).subjects as Subject | null,
  }))

  // Categorize tasks:
  // Today's tasks (scheduled_date === todayStr)
  const todayTasks = allTasks.filter((t) => t.scheduled_date === todayStr)

  // Pending past tasks (scheduled_date < todayStr and status !== 'completed')
  const pendingPastTasks = allTasks.filter(
    (t) => t.scheduled_date < todayStr && t.status === 'pending'
  )

  // Upcoming tasks (scheduled_date > todayStr and status !== 'completed')
  const upcomingTasks = allTasks.filter(
    (t) => t.scheduled_date > todayStr && t.status === 'pending'
  )

  // Completed tasks
  const completedTasks = allTasks.filter((t) => t.status === 'completed')

  return {
    user,
    activeDate,
    todayDate: todayStr,
    subjects: (subjects as Subject[]) || [],
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  // Fetch base dashboard metrics
  const baseData = await getDashboardData()
  if (!baseData) return null

  const todayStr = new Date().toISOString().slice(0, 10)

  // Fetch today's study tasks
  const { data: tasks } = await supabase
    .from('study_tasks')
    .select('*, subjects(*)')
    .eq('user_id', user.id)
    .eq('scheduled_date', todayStr)
    .order('created_at', { ascending: false })

  const todayTasks = (tasks || []).map((t) => ({
    ...t,
    subject: (t as any).subjects as Subject | null,
  })) as StudyTaskWithSubject[]

  const todayCompleted = todayTasks.filter((t) => t.status === 'completed').length

  // Fetch revision summary
  const { data: scheduled } = await supabase
    .from('revision_sessions')
    .select('*, subjects(*)')
    .eq('user_id', user.id)
    .eq('status', 'scheduled')

  const overdueRevisions = (scheduled || []).filter((s) => s.scheduled_date && s.scheduled_date < todayStr)
  const dueTodayRevisions = (scheduled || []).filter((s) => s.scheduled_date === todayStr)
  const upcomingRevisions = (scheduled || []).filter((s) => s.scheduled_date && s.scheduled_date > todayStr)

  // Fetch recent revision history (last 5)
  const { data: recentHistory } = await supabase
    .from('revision_history')
    .select('*, lectures(*, subjects(*))')
    .eq('user_id', user.id)
    .order('revised_at', { ascending: false })
    .limit(5)

  const recentRevisions = (recentHistory || []).map((h) => ({
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

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return null
  }

  // 1. Fetch base dashboard statistics
  const baseData = await getDashboardData()
  if (!baseData) return null

  const { overallStats, subjects } = baseData

  // 2. Syllabus Donut Chart Data
  const unstartedCount = Math.max(
    0,
    overallStats.total_lectures - overallStats.completed_count - overallStats.in_progress_count
  )

  const syllabusDistribution = [
    { name: 'Completed', value: overallStats.completed_count, fill: '#10B981' },
    { name: 'In Progress', value: overallStats.in_progress_count, fill: '#F59E0B' },
    { name: 'Not Started', value: unstartedCount, fill: '#27272A' },
  ]

  // 3. Subject-wise Comparison Bar Chart Data
  const subjectComparison = subjects.map((s) => ({
    name: s.name,
    total: s.total_lectures,
    completed: s.completed_count,
    inProgress: s.in_progress_count,
    percentage: s.progress_percentage,
  }))

  // 4. Completed lectures timeline from lecture_progress
  const { data: completedProgress } = await supabase
    .from('lecture_progress')
    .select('completed_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true })

  const completedByDay = new Map<string, number>()
  for (const p of completedProgress || []) {
    if (p.completed_at) {
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

  // 5. Revision activity timeline from revision_history
  const { data: revHistory } = await supabase
    .from('revision_history')
    .select('revised_at')
    .eq('user_id', user.id)
    .order('revised_at', { ascending: true })

  const revisionByDay = new Map<string, number>()
  for (const r of revHistory || []) {
    const day = r.revised_at.slice(0, 10)
    revisionByDay.set(day, (revisionByDay.get(day) || 0) + 1)
  }

  const revisionTimeline: { date: string; count: number }[] = []
  Array.from(revisionByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([date, count]) => {
      revisionTimeline.push({ date, count })
    })

  // 6. Study tasks statistics
  const { data: allTasks } = await supabase
    .from('study_tasks')
    .select('status, subject_id')
    .eq('user_id', user.id)

  const totalTasks = allTasks?.length || 0
  const completedTasks = allTasks?.filter((t) => t.status === 'completed').length || 0
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
    totalRevisionEvents: revHistory?.length || 0,
    taskStats,
    totalTasks,
    completedTasks,
  }
}
