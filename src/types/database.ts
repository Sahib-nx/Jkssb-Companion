export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Subject = {
  id: string
  user_id?: string | null
  name: string
  slug: string
  total_lectures: number
  is_archived?: boolean
  color?: string | null
  sort_order?: number
  created_at: string
}

export type Lecture = {
  id: string
  user_id?: string | null
  subject_id: string
  lecture_number: number
  title: string
  is_archived?: boolean
  created_at: string
}

export type LectureStatus = 'in_progress' | 'completed'

export type LectureProgress = {
  id: string
  user_id: string
  lecture_id: string
  status: LectureStatus
  started_at: string
  completed_at: string | null
  updated_at: string
}

export type LectureWithProgress = Lecture & {
  progress?: LectureProgress | null
}

export type SubjectWithStats = Subject & {
  completed_count: number
  in_progress_count: number
  remaining_count: number
  progress_percentage: number
}

export type OverallStats = {
  total_lectures: number
  completed_count: number
  in_progress_count: number
  remaining_count: number
  progress_percentage: number
}

// Phase 2: Notes Types
export type LectureNote = {
  id: string
  user_id: string
  lecture_id: string
  content: Json
  plain_text?: string | null
  created_at: string
  updated_at: string
}

export type GeneralNote = {
  id: string
  user_id: string
  subject_id: string | null
  title: string
  content: Json
  plain_text?: string | null
  created_at: string
  updated_at: string
}

export type GeneralNoteWithSubject = GeneralNote & {
  subject?: Subject | null
}

export type LectureWithNotesAndProgress = LectureWithProgress & {
  note?: LectureNote | null
}

// Phase 3: Revision Centre Types
export type RevisionMode = 'single' | 'range' | 'entire_subject' | 'custom'
export type RevisionStatus = 'scheduled' | 'in_progress' | 'completed'

export type RevisionSession = {
  id: string
  user_id: string
  title: string
  subject_id: string | null
  mode: RevisionMode
  scheduled_date: string | null
  status: RevisionStatus
  description: string | null
  created_at: string
  updated_at: string
}

export type RevisionSessionLecture = {
  id: string
  session_id: string
  lecture_id: string
  order_index: number
  is_revised: boolean
  is_difficult: boolean
  needs_re_revision: boolean
  revised_at: string | null
}

export type RevisionHistoryEntry = {
  id: string
  user_id: string
  lecture_id: string
  session_id: string | null
  revised_at: string
  is_difficult: boolean
  needs_re_revision: boolean
  next_revision_date: string | null
  notes: string | null
}

export type SessionLectureWithDetails = RevisionSessionLecture & {
  lecture: Lecture
  note: LectureNote | null
  subject: Subject
}

export type RevisionSessionWithDetails = RevisionSession & {
  subject?: Subject | null
  lectures: SessionLectureWithDetails[]
  total_lectures: number
  revised_count: number
  progress_percentage: number
}

export type LectureRevisionSummary = {
  lecture: Lecture
  subject: Subject
  revision_count: number
  last_revised_at: string | null
  is_difficult: boolean
  needs_re_revision: boolean
  next_revision_date: string | null
  has_notes: boolean
}

// Phase 3: Daily Study Planner Types
export type TaskStatus = 'pending' | 'completed'

export type StudyTask = {
  id: string
  user_id: string
  subject_id: string | null
  title: string
  description: string | null
  scheduled_date: string
  status: TaskStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type StudyTaskWithSubject = StudyTask & {
  subject?: Subject | null
}
