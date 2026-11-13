'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Sparkles,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  CheckCircle2,
  Circle,
  AlertCircle,
  BookOpen,
  Layers,
  RotateCcw,
  Sliders,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  CalendarDays,
  Flame,
  ArrowRight,
  ShieldCheck,
  MinusCircle,
  SkipForward,
} from 'lucide-react'
import {
  AiSyllabusRoadmap,
  TaskStatus,
  DailyScheduledTask,
} from '@/types/database'
import { updateRoadmapTaskStatusAction } from '@/lib/ai/planner/ai-planner-actions'
import { useToast } from '@/components/ui/toast'

interface RoadmapViewProps {
  roadmap: AiSyllabusRoadmap
  onOpenGenerator: () => void
}

export function RoadmapView({ roadmap, onOpenGenerator }: RoadmapViewProps) {
  const toast = useToast()
  const { overview, subject_roadmaps, weekly_milestones, daily_schedule, weekly_review } = roadmap

  const [activeScheduleDayIndex, setActiveScheduleDayIndex] = useState(0)
  const [scheduleState, setScheduleState] = useState(daily_schedule)
  const [expandedWeek, setExpandedWeek] = useState<number>(1)

  // Quick toggle task status
  const handleToggleTaskStatus = async (
    dayIndex: number,
    taskId: string,
    currentStatus: TaskStatus,
    targetStatus?: TaskStatus
  ) => {
    const nextStatus: TaskStatus =
      targetStatus || (currentStatus === 'completed' ? 'pending' : 'completed')

    // Optimistic UI update
    setScheduleState((prev) => {
      const copy = [...prev]
      const day = copy[dayIndex]
      if (day) {
        day.tasks = day.tasks.map((t) =>
          t.id === taskId ? { ...t, status: nextStatus } : t
        )
      }
      return copy
    })

    try {
      await updateRoadmapTaskStatusAction({
        taskId,
        status: nextStatus,
        roadmapId: roadmap.id,
      })
      toast.success(
        nextStatus === 'completed'
          ? 'Task marked as completed!'
          : nextStatus === 'partially_completed'
          ? 'Task marked as partially completed.'
          : nextStatus === 'skipped'
          ? 'Task skipped for today.'
          : 'Task reopened.'
      )
    } catch {
      toast.error('Failed to sync task status.')
    }
  }

  const activeDay = scheduleState[activeScheduleDayIndex] || scheduleState[0]

  return (
    <div className="space-y-6">
      {/* SECTION A: OVERALL SYLLABUS ROADMAP HERO */}
      <Card className="border-purple-500/25 bg-[#11141D] shadow-xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-zinc-800/80 bg-white/[0.01]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <CardTitle className="text-base sm:text-lg text-white font-semibold">
                    AI Syllabus Roadmap
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30"
                  >
                    Active Plan
                  </Badge>
                </div>
                <CardDescription className="text-xs text-zinc-400 mt-0.5">
                  Calculated for {overview.daily_study_hours} hrs/day across {overview.study_days_per_week} study days/week
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenGenerator}
                className="h-8 text-xs border-zinc-800 text-zinc-300 hover:text-white"
              >
                <Sliders className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Rebalance Plan
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 pt-5 text-xs text-zinc-300">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800">
              <span className="text-[11px] text-zinc-500 uppercase font-semibold block mb-1">
                Estimated Finish
              </span>
              <span className="text-sm font-semibold text-white block truncate">
                {overview.estimated_completion_date}
              </span>
              <span className="text-[10px] text-zinc-500">
                ~{overview.estimated_weeks_needed} weeks ({overview.estimated_days_needed} days)
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800">
              <span className="text-[11px] text-zinc-500 uppercase font-semibold block mb-1">
                Remaining Workload
              </span>
              <span className="text-sm font-semibold text-purple-300 block truncate">
                {overview.remaining_lectures} Lectures
              </span>
              <span className="text-[10px] text-zinc-500">
                Across {overview.total_subjects} subjects
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800">
              <span className="text-[11px] text-zinc-500 uppercase font-semibold block mb-1">
                Pacing Feasibility
              </span>
              <div className="flex items-center space-x-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    overview.target_date_feasible ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="font-semibold text-white">
                  {overview.target_date_feasible ? 'Achievable' : 'Intensive'}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 truncate block">
                {overview.target_date ? `Target: ${overview.target_date}` : 'Self-paced'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800">
              <span className="text-[11px] text-zinc-500 uppercase font-semibold block mb-1">
                Syllabus Progress
              </span>
              <span className="text-sm font-semibold text-emerald-400 block truncate">
                {overview.overall_progress_percentage}%
              </span>
              <span className="text-[10px] text-zinc-500">
                {overview.completed_lectures} / {overview.total_lectures} completed
              </span>
            </div>
          </div>

          {/* Feasibility Explanation Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-start space-x-3 text-xs leading-relaxed ${
              overview.target_date_feasible
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-200'
            }`}
          >
            {overview.target_date_feasible ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <strong className="text-white block mb-0.5">Strategic Analysis:</strong>
              {overview.feasibility_explanation}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION B: SUBJECT-WISE ROADMAP TARGETS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Subject-Wise Target Distribution</h3>
          </div>
          <span className="text-xs text-zinc-500">
            {subject_roadmaps.length} active subjects
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {subject_roadmaps.map((sr) => {
            const priorityBadge =
              sr.priority === 'high'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                : sr.priority === 'medium'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700'

            return (
              <Card key={sr.subject_id} className="border-zinc-800/80 bg-[#11141D] shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-white">
                      {sr.subject_name}
                    </CardTitle>
                    <Badge variant="outline" className={`text-[10px] uppercase ${priorityBadge}`}>
                      {sr.priority} Priority
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mt-1">
                    <span>Target: <strong>{sr.weekly_lecture_target}</strong> lectures / week</span>
                    <span>{sr.completed_lectures} / {sr.total_lectures} Done ({sr.progress_percentage}%)</span>
                  </div>
                  <Progress value={sr.progress_percentage} className="h-1.5 mt-2 bg-zinc-800" />
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs text-zinc-300 pt-0">
                  <div className="p-2.5 rounded-lg bg-[#0B0D12] border border-zinc-800/80 space-y-1">
                    <span className="text-[11px] font-medium text-purple-300 block">
                      Recommended Strategy
                    </span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {sr.recommended_strategy}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-[#0B0D12] border border-zinc-800/80 space-y-1">
                    <span className="text-[11px] font-medium text-cyan-300 block">
                      Practice & Revision
                    </span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {sr.practice_advice}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* SECTION C: WEEKLY MILESTONES */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Weekly Progression Milestones</h3>
        </div>

        <div className="space-y-3">
          {weekly_milestones.map((wm) => {
            const isExpanded = expandedWeek === wm.week_number

            return (
              <Card
                key={wm.week_number}
                className="border-zinc-800/80 bg-[#11141D] shadow-sm overflow-hidden"
              >
                <div
                  onClick={() => setExpandedWeek(isExpanded ? 0 : wm.week_number)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center justify-center font-semibold text-xs shrink-0">
                      W{wm.week_number}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-white">{wm.week_label}</h4>
                      <p className="text-[11px] text-zinc-400">
                        {wm.start_date} to {wm.end_date} • Expected Milestone: {wm.expected_cumulative_progress}% Syllabus Done
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-800">
                      Catch-up: {wm.catchup_day}
                    </Badge>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 px-4 border-t border-zinc-800/60 text-xs space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                      <div className="space-y-1.5">
                        <span className="font-semibold text-white text-xs block">Subject Targets</span>
                        <ul className="space-y-1 text-zinc-400">
                          {wm.subject_targets.map((st) => (
                            <li key={st.subject_id} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-[#0B0D12]">
                              <span className="text-zinc-200">{st.subject_name}</span>
                              <span className="text-purple-300 font-medium">+{st.target_lectures_count} lectures</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <span className="font-semibold text-white text-xs block mb-1">Practice Objectives</span>
                          <ul className="list-disc list-inside text-[11px] text-zinc-400 space-y-0.5">
                            {wm.practice_goals.map((pg, i) => (
                              <li key={i}>{pg}</li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <span className="font-semibold text-white text-xs block mb-1">Revision Objectives</span>
                          <ul className="list-disc list-inside text-[11px] text-zinc-400 space-y-0.5">
                            {wm.revision_goals.map((rg, i) => (
                              <li key={i}>{rg}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* SECTION D: DAILY STUDY SCHEDULE TIMELINE */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <CalendarDays className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Daily Study Schedule (14-Day Roadmap)</h3>
          </div>
          <span className="text-xs text-zinc-400">
            Interactive day-by-day task checklist
          </span>
        </div>

        {/* Day Pills Bar */}
        <div className="flex items-center space-x-2 overflow-x-auto p-1.5 bg-[#11141D] border border-zinc-800 rounded-xl no-scrollbar">
          {scheduleState.map((day, idx) => {
            const isSelected = idx === activeScheduleDayIndex
            const completedCount = day.tasks.filter((t) => t.status === 'completed').length
            const isAllDone = day.tasks.length > 0 && completedCount === day.tasks.length

            return (
              <button
                key={day.date}
                onClick={() => setActiveScheduleDayIndex(idx)}
                className={`flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-all min-w-[70px] ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm font-semibold'
                    : 'bg-[#0B0D12] text-zinc-400 hover:text-white border border-zinc-800/80'
                }`}
              >
                <span className="text-[10px] uppercase">{day.day_name.slice(0, 3)}</span>
                <span className="text-xs font-bold my-0.5">{day.date.slice(8, 10)}</span>
                {day.is_off_day ? (
                  <span className="text-[9px] text-amber-300/80">Off Day</span>
                ) : isAllDone ? (
                  <Check className="w-3 h-3 text-emerald-300" />
                ) : (
                  <span className="text-[9px] opacity-75">{day.total_minutes}m</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Selected Day Task List Card */}
        {activeDay && (
          <Card className="border-zinc-800 bg-[#11141D] shadow-md">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-white">
                    {activeDay.day_name}, {activeDay.date}
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-400">
                    {activeDay.is_off_day
                      ? 'Rest & catch-up day. Re-read notes or practice weak areas at your own pace.'
                      : `${activeDay.tasks.length} planned activities • ${activeDay.total_minutes} mins total study time`}
                  </CardDescription>
                </div>
                {activeDay.is_off_day && (
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-300 bg-amber-500/10">
                    Rest Day
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-2.5">
              {activeDay.tasks.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  No mandatory tasks scheduled for this day. Enjoy your rest or review difficult flashcards!
                </div>
              ) : (
                activeDay.tasks.map((task) => {
                  const isDone = task.status === 'completed'
                  const isPartial = task.status === 'partially_completed'
                  const isSkipped = task.status === 'skipped'

                  const typeBadgeClass =
                    task.task_type === 'lecture'
                      ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                      : task.task_type === 'practice'
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
                      : task.task_type === 'recall'
                      ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/20'

                  return (
                    <div
                      key={task.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                        isDone
                          ? 'bg-emerald-500/5 border-emerald-500/20 opacity-75'
                          : isSkipped
                          ? 'bg-zinc-900/50 border-zinc-800 opacity-60'
                          : 'bg-[#0B0D12] border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <button
                          onClick={() =>
                            handleToggleTaskStatus(
                              activeScheduleDayIndex,
                              task.id,
                              task.status
                            )
                          }
                          className="mt-0.5 text-zinc-400 hover:text-white transition-colors"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : isPartial ? (
                            <MinusCircle className="w-5 h-5 text-amber-400" />
                          ) : isSkipped ? (
                            <SkipForward className="w-5 h-5 text-zinc-500" />
                          ) : (
                            <Circle className="w-5 h-5 text-zinc-600 hover:text-zinc-400" />
                          )}
                        </button>

                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span
                              className={`text-xs font-semibold ${
                                isDone
                                  ? 'line-through text-zinc-500'
                                  : isSkipped
                                  ? 'text-zinc-500 line-through'
                                  : 'text-white'
                              }`}
                            >
                              {task.task_title}
                            </span>
                            <Badge variant="outline" className={`text-[10px] uppercase ${typeBadgeClass}`}>
                              {task.task_type}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-800">
                              {task.estimated_minutes}m
                            </Badge>
                          </div>

                          {task.lecture_id && (
                            <Link
                              href={`/dashboard/lectures/${task.lecture_id}`}
                              className="text-[11px] text-purple-400 hover:text-purple-300 inline-flex items-center space-x-1"
                            >
                              <span>Open Lecture Workspace</span>
                              <ArrowRight className="w-3 h-3 ml-0.5" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Status action buttons */}
                      <div className="flex items-center space-x-1.5 self-end sm:self-center">
                        <button
                          onClick={() =>
                            handleToggleTaskStatus(
                              activeScheduleDayIndex,
                              task.id,
                              task.status,
                              isDone ? 'pending' : 'completed'
                            )
                          }
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                            isDone
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          {isDone ? 'Completed' : 'Done'}
                        </button>

                        <button
                          onClick={() =>
                            handleToggleTaskStatus(
                              activeScheduleDayIndex,
                              task.id,
                              task.status,
                              isPartial ? 'pending' : 'partially_completed'
                            )
                          }
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                            isPartial
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400'
                          }`}
                          title="Mark Partially Completed"
                        >
                          Partial
                        </button>

                        <button
                          onClick={() =>
                            handleToggleTaskStatus(
                              activeScheduleDayIndex,
                              task.id,
                              task.status,
                              isSkipped ? 'pending' : 'skipped'
                            )
                          }
                          className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                            isSkipped
                              ? 'bg-zinc-700 text-zinc-300'
                              : 'bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400'
                          }`}
                          title="Skip Task"
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* SECTION E: WEEKLY REVIEW & ADAPTIVE FEEDBACK */}
      <Card className="border-zinc-800/80 bg-[#11141D] shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-sm font-semibold text-white">
                Weekly Adherence & Adaptive Review
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-800">
              Week 1 Review
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-xs text-zinc-300">
          <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800 space-y-1.5">
            <span className="font-semibold text-white text-xs block">
              Catch-up & Progress Guidance
            </span>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {weekly_review.catchup_recommendations}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="font-semibold text-white text-xs block">
              Next Week Priorities
            </span>
            <ul className="list-disc list-inside space-y-1 text-zinc-400 text-[11px]">
              {weekly_review.next_week_priorities.map((nwp, idx) => (
                <li key={idx}>{nwp}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
