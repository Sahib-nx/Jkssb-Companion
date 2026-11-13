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

// Phase 3 & AI Syllabus Planner: Daily Study Planner Types
export type TaskStatus = 'pending' | 'completed' | 'partially_completed' | 'skipped'
export type TaskType = 'lecture' | 'practice' | 'revision' | 'recall' | 'catchup' | 'custom'
export type TaskPriority = 'high' | 'medium' | 'low'

export type StudyTask = {
  id: string
  user_id: string
  subject_id: string | null
  title: string
  description: string | null
  scheduled_date: string
  status: TaskStatus
  completed_at: string | null
  task_type?: TaskType
  lecture_id?: string | null
  is_ai_generated?: boolean
  roadmap_id?: string | null
  priority?: TaskPriority
  estimated_minutes?: number
  created_at: string
  updated_at: string
}

export type StudyTaskWithSubject = StudyTask & {
  subject?: Subject | null
  lecture?: Lecture | null
}

// AI-Powered Syllabus Planner Types
export interface SyllabusOverview {
  total_subjects: number
  total_lectures: number
  completed_lectures: number
  remaining_lectures: number
  overall_progress_percentage: number
  daily_study_hours: number
  study_days_per_week: number
  estimated_days_needed: number
  estimated_weeks_needed: number
  estimated_completion_date: string
  target_date?: string | null
  target_date_feasible?: boolean
  feasibility_explanation?: string
  workload_summary?: string
}

export interface SubjectRoadmapItem {
  subject_id: string
  subject_name: string
  total_lectures: number
  completed_lectures: number
  remaining_lectures: number
  progress_percentage: number
  weekly_lecture_target: number
  priority: 'high' | 'medium' | 'low'
  recommended_strategy: string
  practice_advice: string
  revision_frequency: string
}

export interface WeeklyMilestone {
  week_number: number
  week_label: string
  start_date: string
  end_date: string
  subject_targets: {
    subject_id: string
    subject_name: string
    target_lectures_count: number
    lecture_range?: string
  }[]
  practice_goals: string[]
  revision_goals: string[]
  expected_cumulative_progress: number
  catchup_day: string
}

export interface DailyScheduledTask {
  id: string
  subject_id: string
  subject_name: string
  lecture_id?: string | null
  lecture_number?: number | null
  lecture_title?: string | null
  task_title: string
  task_type: TaskType
  estimated_minutes: number
  priority: TaskPriority
  status: TaskStatus
}

export interface DailyScheduledDay {
  date: string
  day_name: string
  is_off_day: boolean
  total_minutes: number
  tasks: DailyScheduledTask[]
}

export interface WeeklyReviewSummary {
  planned_lectures: number
  completed_lectures: number
  completion_rate_percentage: number
  subject_progress: { subject_id: string; subject_name: string; completed: number; total_planned: number }[]
  pending_tasks_count: number
  catchup_recommendations: string
  next_week_priorities: string[]
}

export interface AiSyllabusRoadmap {
  id: string
  user_id: string
  daily_study_hours: number
  target_date: string | null
  unavailable_days: string[]
  status: 'active' | 'completed' | 'archived'
  overview: SyllabusOverview
  subject_roadmaps: SubjectRoadmapItem[]
  weekly_milestones: WeeklyMilestone[]
  daily_schedule: DailyScheduledDay[]
  weekly_review: WeeklyReviewSummary
  created_at: string
  updated_at: string
}

// AI Study Assistant Types
export interface PlannerProposalTaskReschedule {
  taskId: string
  taskTitle: string
  currentScheduledDate: string
  newScheduledDate: string
  reason?: string
}

export interface PlannerProposalTaskAdd {
  subjectId?: string | null
  subjectName?: string
  lectureId?: string | null
  taskTitle: string
  scheduledDate: string
  estimatedMinutes: number
  taskType: TaskType
  priority: TaskPriority
}

export interface PlannerProposal {
  id: string
  type:
    | 'reschedule_tasks'
    | 'adjust_hours'
    | 'prioritize_subject'
    | 'add_rest_day'
    | 'regenerate_roadmap'
    | 'custom'
  title: string
  summary: string
  status: 'pending' | 'applied' | 'cancelled'
  tasks_to_reschedule?: PlannerProposalTaskReschedule[]
  tasks_to_add?: PlannerProposalTaskAdd[]
  tasks_to_postpone?: PlannerProposalTaskReschedule[]
  new_daily_hours?: number
  new_completion_date?: string
  impact_summary: string
}

export interface PlannerAssistantMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  proposal?: PlannerProposal | null
  created_at: string
}

export interface OverviewAssistantMessage {
  id: string
  user_id?: string
  role: 'user' | 'assistant'
  content: string
  proposal?: PlannerProposal | null
  suggestedFollowUps?: string[]
  created_at: string
}

export interface AnalyticsInsightItem {
  id: string
  type: 'velocity' | 'comparison' | 'retention' | 'backlog' | 'projection' | 'habit'
  title: string
  value: string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  badgeColor?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose'
}

export interface AnalyticsAssistantMessage {
  id: string
  user_id?: string
  role: 'user' | 'assistant'
  content: string
  insights?: AnalyticsInsightItem[]
  proposal?: PlannerProposal | null
  suggestedFollowUps?: string[]
  created_at: string
}

