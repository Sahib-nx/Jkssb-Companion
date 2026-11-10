'use client'

import { useState, useTransition } from 'react'
import { Subject, StudyTaskWithSubject, TaskStatus } from '@/types/database'
import {
  createStudyTask,
  updateStudyTask,
  toggleTaskStatus,
  deleteStudyTask,
} from '@/app/dashboard/planner/actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Calendar,
  Folder,
  Trash2,
  Edit2,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

import { useToast } from '@/components/ui/toast'

interface PlannerClientProps {
  todayDate: string
  subjects: Subject[]
  todayTasks: StudyTaskWithSubject[]
  pendingPastTasks: StudyTaskWithSubject[]
  upcomingTasks: StudyTaskWithSubject[]
  completedTasks: StudyTaskWithSubject[]
  totalCount: number
  todayCompletedCount: number
}

export function PlannerClient({
  todayDate,
  subjects,
  todayTasks,
  pendingPastTasks,
  upcomingTasks,
  completedTasks,
  totalCount,
  todayCompletedCount,
}: PlannerClientProps) {
  const toast = useToast()
  const [showCreator, setShowCreator] = useState(false)
  const [editingTask, setEditingTask] = useState<StudyTaskWithSubject | null>(null)

  // Creator / Editor Form State
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState<string>('')
  const [scheduledDate, setScheduledDate] = useState<string>(todayDate)
  const [description, setDescription] = useState('')

  const [isPending, startTransition] = useTransition()
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [reschedulingTaskId, setReschedulingTaskId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(true)

  // Open Create Modal
  const openCreateModal = (defaultDate = todayDate) => {
    setEditingTask(null)
    setTitle('')
    setSubjectId('')
    setScheduledDate(defaultDate)
    setDescription('')
    setShowCreator(true)
  }

  // Open Edit Modal
  const openEditModal = (task: StudyTaskWithSubject) => {
    setEditingTask(task)
    setTitle(task.title)
    setSubjectId(task.subject_id || '')
    setScheduledDate(task.scheduled_date)
    setDescription(task.description || '')
    setShowCreator(true)
  }

  // Handle Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || isPending) return

    startTransition(async () => {
      try {
        if (editingTask) {
          const res = await updateStudyTask({
            taskId: editingTask.id,
            title,
            subjectId: subjectId || null,
            scheduledDate,
            description: description || null,
          })
          if (res.success) {
            toast.success('Task updated successfully')
          } else {
            toast.error(res.error || 'Failed to update task')
          }
        } else {
          const res = await createStudyTask({
            title,
            subjectId: subjectId || null,
            scheduledDate,
            description: description || null,
          })
          if (res.success) {
            toast.success('Study task created successfully')
          } else {
            toast.error(res.error || 'Failed to create task')
          }
        }
        setShowCreator(false)
        setEditingTask(null)
      } catch (err: any) {
        toast.error(err?.message || 'Failed to save task')
      }
    })
  }

  // Toggle Completion
  const handleToggle = (task: StudyTaskWithSubject) => {
    if (togglingTaskId) return
    setTogglingTaskId(task.id)
    startTransition(async () => {
      try {
        const nextStatus = task.status === 'completed' ? 'pending' : 'completed'
        const res = await toggleTaskStatus(task.id, task.status)
        if (res.success) {
          if (nextStatus === 'completed') {
            toast.success('Task completed!')
          } else {
            toast.info('Task marked incomplete')
          }
        } else {
          toast.error(res.error || 'Failed to update task')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update task')
      } finally {
        setTogglingTaskId(null)
      }
    })
  }

  // Delete Task
  const handleDelete = (task: StudyTaskWithSubject) => {
    if (deletingTaskId) return
    if (!window.confirm(`Delete task "${task.title}"?`)) return
    setDeletingTaskId(task.id)
    startTransition(async () => {
      try {
        const res = await deleteStudyTask(task.id)
        if (res.success) {
          toast.success('Task deleted')
        } else {
          toast.error(res.error || 'Failed to delete task')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to delete task')
      } finally {
        setDeletingTaskId(null)
      }
    })
  }

  // Reschedule Past Task to Today
  const handleRescheduleToToday = (task: StudyTaskWithSubject) => {
    if (reschedulingTaskId) return
    setReschedulingTaskId(task.id)
    startTransition(async () => {
      try {
        const res = await updateStudyTask({
          taskId: task.id,
          title: task.title,
          subjectId: task.subject_id,
          scheduledDate: todayDate,
          description: task.description,
        })
        if (res.success) {
          toast.success('Task moved to today')
        } else {
          toast.error(res.error || 'Failed to move task')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to move task')
      } finally {
        setReschedulingTaskId(null)
      }
    })
  }

  const todayPercentage =
    todayTasks.length > 0 ? Math.round((todayCompletedCount / todayTasks.length) * 100) : 0

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Daily Study Planner
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Organize daily tasks, schedule syllabus topics, and track preparation goals
          </p>
        </div>

        <Button onClick={() => openCreateModal(todayDate)} className="shrink-0">
          <Plus className="w-4 h-4 mr-1.5" />
          <span>Add Study Task</span>
        </Button>
      </div>

      {/* Task Creation / Editing Dialog / Banner */}
      {showCreator && (
        <Card className="border-blue-500/40 bg-[#11141D] p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                {editingTask ? 'Edit Study Task' : 'New Study Task'}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreator(false)}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs text-zinc-300">Task Title *</label>
                <Input
                  required
                  placeholder="e.g. Revise General Knowledge Lectures 010-020"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-300">Scheduled Date</label>
                <Input
                  type="date"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-300">Subject (Optional)</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full h-9 rounded-lg border border-zinc-700 bg-[#0E1118] px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">General / No Subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-xs text-zinc-300">Description / Details (Optional)</label>
                <Input
                  placeholder="e.g. Focus on dates, article numbers, and practice questions"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreator(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="text-xs">
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1" />
                )}
                {editingTask ? 'Save Changes' : 'Create Task'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Today's Goal & Progress Banner */}
      <Card className="border-zinc-800/80 bg-[#11141D]">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <CardTitle className="text-base text-white">
                  Today&apos;s Focus &bull; {formatDate(todayDate)}
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                {todayCompletedCount} of {todayTasks.length} tasks completed today
              </CardDescription>
            </div>

            <div className="text-right">
              <span className="text-2xl font-bold text-blue-400">{todayPercentage}%</span>
              <p className="text-[11px] text-zinc-500">Today&apos;s Completion</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress
            value={todayPercentage}
            className="h-2"
            indicatorClassName="bg-gradient-to-r from-blue-600 to-emerald-500"
          />
        </CardContent>
      </Card>

      {/* Section 1: Today's Tasks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white flex items-center">
            <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
            Today&apos;s Tasks ({todayTasks.length})
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openCreateModal(todayDate)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add for Today
          </Button>
        </div>

        {todayTasks.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-[#11141D] border border-zinc-800/80">
            <p className="text-xs text-zinc-400">No tasks scheduled for today yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isToggling={togglingTaskId === task.id}
                isDeleting={deletingTaskId === task.id}
                onToggle={() => handleToggle(task)}
                onEdit={() => openEditModal(task)}
                onDelete={() => handleDelete(task)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Pending (Past Due) Tasks */}
      {pendingPastTasks.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400">
              Pending from Earlier Days ({pendingPastTasks.length})
            </h2>
          </div>

          <div className="space-y-2">
            {pendingPastTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 gap-3"
              >
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggle(task)}
                    disabled={togglingTaskId === task.id}
                    className="mt-0.5 text-zinc-500 hover:text-white transition-colors"
                  >
                    {togglingTaskId === task.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>

                  <div>
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{task.title}</span>
                      {task.subject && (
                        <Badge variant="outline" className="text-[10px]">
                          {task.subject.name}
                        </Badge>
                      )}
                      <span className="text-[11px] text-amber-400">
                        Scheduled for: {formatDate(task.scheduled_date)}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-zinc-400 mt-0.5">{task.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={reschedulingTaskId === task.id || deletingTaskId === task.id}
                    onClick={() => handleRescheduleToToday(task)}
                    className="h-7 text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                  >
                    {reschedulingTaskId === task.id ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin mr-1 text-amber-400" />
                        Moving...
                      </>
                    ) : (
                      'Move to Today'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deletingTaskId === task.id || reschedulingTaskId === task.id}
                    onClick={() => handleDelete(task)}
                    className="h-7 px-2 text-zinc-500 hover:text-red-400"
                  >
                    {deletingTaskId === task.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Upcoming Tasks */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 flex items-center">
          <CalendarDays className="w-4 h-4 mr-2 text-zinc-500" />
          Upcoming Scheduled Tasks ({upcomingTasks.length})
        </h2>

        {upcomingTasks.length === 0 ? (
          <p className="text-xs text-zinc-500 italic">No future tasks scheduled yet.</p>
        ) : (
          <div className="space-y-2">
            {upcomingTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isToggling={togglingTaskId === task.id}
                isDeleting={deletingTaskId === task.id}
                onToggle={() => handleToggle(task)}
                onEdit={() => openEditModal(task)}
                onDelete={() => handleDelete(task)}
                showDate
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 4: Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-zinc-800/60">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center space-x-2 text-xs font-semibold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors"
          >
            <span>Completed Tasks ({completedTasks.length})</span>
            {showCompleted ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showCompleted && (
            <div className="space-y-2 opacity-70">
              {completedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  isToggling={togglingTaskId === task.id}
                  isDeleting={deletingTaskId === task.id}
                  onToggle={() => handleToggle(task)}
                  onEdit={() => openEditModal(task)}
                  onDelete={() => handleDelete(task)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TaskRow({
  task,
  isToggling,
  isDeleting = false,
  onToggle,
  onEdit,
  onDelete,
  showDate = false,
}: {
  task: StudyTaskWithSubject
  isToggling: boolean
  isDeleting?: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  showDate?: boolean
}) {
  const isCompleted = task.status === 'completed'

  return (
    <div
      className={`flex items-start sm:items-center justify-between p-3.5 rounded-xl border transition-all gap-3 ${
        isCompleted
          ? 'bg-[#11141D]/50 border-zinc-800/60'
          : 'bg-[#11141D] border-zinc-800/80 hover:border-zinc-700/80'
      }`}
    >
      <div className="flex items-start space-x-3 flex-1 min-w-0">
        <button
          onClick={onToggle}
          disabled={isToggling || isDeleting}
          className="mt-0.5 text-zinc-400 hover:text-white transition-colors shrink-0"
        >
          {isToggling ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          ) : isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Circle className="w-4 h-4 text-zinc-600 hover:text-zinc-400" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span
              className={`text-xs sm:text-sm font-medium ${
                isCompleted ? 'line-through text-zinc-500' : 'text-white'
              }`}
            >
              {task.title}
            </span>

            {task.subject && (
              <Badge variant="outline" className="text-[10px]">
                {task.subject.name}
              </Badge>
            )}

            {showDate && (
              <span className="text-[11px] text-zinc-500">
                {task.scheduled_date}
              </span>
            )}
          </div>

          {task.description && (
            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-1 shrink-0 self-end sm:self-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={isToggling || isDeleting}
          className="h-7 px-2 text-zinc-500 hover:text-white"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isToggling || isDeleting}
          className="h-7 px-2 text-zinc-500 hover:text-red-400"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}
