'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Subject,
  Lecture,
  LectureProgress,
  LectureNote,
  Json,
} from '@/types/database'
import { saveLectureNote, deleteLectureNote } from '@/app/dashboard/notes/actions'
import { updateLectureProgress, type TargetStatus } from '@/app/dashboard/tracker/actions'
import { RichTextEditor } from '@/components/rich-text-editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Circle,
  RotateCcw,
  Play,
  Check,
  Calendar,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface LectureNoteClientProps {
  lecture: Lecture
  subject: Subject
  initialProgress: LectureProgress | null
  initialNote: LectureNote | null
  prevLecture: { id: string; lecture_number: number; title: string } | null
  nextLecture: { id: string; lecture_number: number; title: string } | null
}

export function LectureNoteClient({
  lecture,
  subject,
  initialProgress,
  initialNote,
  prevLecture,
  nextLecture,
}: LectureNoteClientProps) {
  const toast = useToast()
  const [progress, setProgress] = useState<LectureProgress | null>(initialProgress)
  const [pendingStatusAction, setPendingStatusAction] = useState<TargetStatus | null>(null)
  const [isUpdatingStatus, startStatusTransition] = useTransition()

  const status = progress?.status || 'not_started'

  // Handle status update
  const handleStatusChange = (targetStatus: TargetStatus) => {
    if (pendingStatusAction) return
    setPendingStatusAction(targetStatus)
    startStatusTransition(async () => {
      try {
        const res = await updateLectureProgress(lecture.id, targetStatus)
        if (res.success) {
          if (targetStatus === 'not_started') {
            setProgress(null)
            toast.info('Lecture reset to not started')
          } else if (targetStatus === 'in_progress') {
            setProgress((prev) => ({
              id: prev?.id || 'temp',
              user_id: prev?.user_id || '',
              lecture_id: lecture.id,
              status: 'in_progress',
              started_at: prev?.started_at || new Date().toISOString(),
              completed_at: null,
              updated_at: new Date().toISOString(),
            }))
            toast.info('Lecture marked as in progress')
          } else if (targetStatus === 'completed') {
            setProgress((prev) => ({
              id: prev?.id || 'temp',
              user_id: prev?.user_id || '',
              lecture_id: lecture.id,
              status: 'completed',
              started_at: prev?.started_at || new Date().toISOString(),
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }))
            toast.success('Lecture marked as completed!')
          }
        } else {
          toast.error(res.error || 'Failed to update lecture status')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update lecture status')
      } finally {
        setPendingStatusAction(null)
      }
    })
  }

  // Handle Save Note
  const handleSaveNote = async (content: Json, plainText: string): Promise<boolean> => {
    const res = await saveLectureNote(lecture.id, content, plainText)
    if (res.success) {
      toast.success('Notes saved successfully')
      return true
    } else {
      toast.error(res.error || 'Unable to save notes. Please try again.')
      return false
    }
  }

  // Handle Delete Note
  const handleDeleteNote = async (): Promise<boolean> => {
    const confirmed = window.confirm(
      'Are you sure you want to delete all notes for this lecture? This action cannot be undone.'
    )
    if (!confirmed) return false

    const res = await deleteLectureNote(lecture.id)
    if (res.success) {
      toast.success('Lecture notes deleted')
      window.location.reload()
      return true
    }
    toast.error(res.error || 'Failed to delete note')
    return false
  }

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Next/Prev Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
          <Link
            href="/dashboard/lecture-notes"
            className="hover:text-white flex items-center transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Lecture Notes
          </Link>
          <span>/</span>
          <Link
            href={`/dashboard/lecture-notes?subject=${subject.slug}`}
            className="hover:text-white transition-colors shrink-0"
          >
            {subject.name}
          </Link>
          <span>/</span>
          <span className="text-zinc-200 font-medium truncate max-w-[140px] sm:max-w-none">{lecture.title}</span>
        </div>

        {/* Previous and Next Lecture Navigation */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          {prevLecture ? (
            <Link href={`/dashboard/lectures/${prevLecture.id}`} className="flex-1 sm:flex-initial">
              <Button
                variant="outline"
                size="sm"
                className="h-8.5 sm:h-8 text-xs border-zinc-800 hover:bg-zinc-800 w-full sm:w-auto max-w-[150px] sm:max-w-[200px]"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1 shrink-0" />
                <span className="truncate">{prevLecture.title}</span>
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-8.5 sm:h-8 text-xs opacity-40 border-zinc-800 flex-1 sm:flex-initial max-w-[150px] sm:max-w-[200px]"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1 shrink-0" />
              <span>Start</span>
            </Button>
          )}

          {nextLecture ? (
            <Link href={`/dashboard/lectures/${nextLecture.id}`} className="flex-1 sm:flex-initial">
              <Button
                variant="outline"
                size="sm"
                className="h-8.5 sm:h-8 text-xs border-zinc-800 hover:bg-zinc-800 w-full sm:w-auto max-w-[150px] sm:max-w-[200px]"
              >
                <span className="truncate">{nextLecture.title}</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1 shrink-0" />
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-8.5 sm:h-8 text-xs opacity-40 border-zinc-800 flex-1 sm:flex-initial max-w-[150px] sm:max-w-[200px]"
            >
              <span>End</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1 shrink-0" />
            </Button>
          )}
        </div>
      </div>

      {/* Lecture Title, Subject, and Progress Status Banner */}
      <div className="p-4 sm:p-5 rounded-xl border border-zinc-800/80 bg-[#11141D] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5 mb-1.5 flex-wrap gap-y-1">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-medium">
              {subject.name} &bull; Lecture #{lecture.lecture_number}
            </span>
            {status === 'completed' && <Badge variant="success">Completed</Badge>}
            {status === 'in_progress' && <Badge variant="warning">In Progress</Badge>}
            {status === 'not_started' && <Badge variant="secondary">Not Started</Badge>}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {lecture.title}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400 mt-1.5">
            {progress?.started_at && (
              <span className="inline-flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-zinc-500" />
                Started: {formatDate(progress.started_at)}
              </span>
            )}
            {progress?.completed_at && (
              <span className="inline-flex items-center text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5 mr-1" />
                Completed: {formatDate(progress.completed_at)}
              </span>
            )}
          </div>
        </div>

        {/* Progress Action Controls */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full md:w-auto pt-2.5 md:pt-0 border-t border-zinc-800/40 md:border-0 shrink-0">
          {status === 'not_started' && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="h-9 sm:h-8 text-xs text-amber-300 hover:text-amber-200 flex-1 sm:flex-initial min-h-[36px]"
                disabled={isUpdatingStatus || !!pendingStatusAction}
                onClick={() => handleStatusChange('in_progress')}
              >
                {pendingStatusAction === 'in_progress' ? (
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 mr-1.5" />
                )}
                {pendingStatusAction === 'in_progress' ? 'Starting...' : 'Mark In Progress'}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-9 sm:h-8 text-xs bg-emerald-600 hover:bg-emerald-500 flex-1 sm:flex-initial min-h-[36px]"
                disabled={isUpdatingStatus || !!pendingStatusAction}
                onClick={() => handleStatusChange('completed')}
              >
                {pendingStatusAction === 'completed' ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1" />
                )}
                {pendingStatusAction === 'completed' ? 'Completing...' : 'Mark Completed'}
              </Button>
            </>
          )}

          {status === 'in_progress' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 sm:h-8 text-xs text-zinc-400 hover:text-zinc-200 flex-1 sm:flex-initial min-h-[36px]"
                disabled={isUpdatingStatus || !!pendingStatusAction}
                onClick={() => handleStatusChange('not_started')}
              >
                {pendingStatusAction === 'not_started' ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3 mr-1" />
                )}
                {pendingStatusAction === 'not_started' ? 'Resetting...' : 'Reset'}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-9 sm:h-8 text-xs bg-emerald-600 hover:bg-emerald-500 flex-1 sm:flex-initial min-h-[36px]"
                disabled={isUpdatingStatus || !!pendingStatusAction}
                onClick={() => handleStatusChange('completed')}
              >
                {pendingStatusAction === 'completed' ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1" />
                )}
                {pendingStatusAction === 'completed' ? 'Completing...' : 'Complete Lecture'}
              </Button>
            </>
          )}

          {status === 'completed' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-9 sm:h-8 text-xs text-zinc-400 hover:text-amber-400 hover:border-amber-500/30 flex-1 sm:flex-initial min-h-[36px]"
                disabled={isUpdatingStatus || !!pendingStatusAction}
                onClick={() => handleStatusChange('in_progress')}
              >
                {pendingStatusAction === 'in_progress' ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Clock className="w-3 h-3 mr-1" />
                )}
                {pendingStatusAction === 'in_progress' ? 'Reopening...' : 'Reopen to In Progress'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 sm:h-8 text-xs text-zinc-400 hover:text-red-400 hover:border-red-500/30 flex-1 sm:flex-initial min-h-[36px]"
                disabled={isUpdatingStatus || !!pendingStatusAction}
                onClick={() => handleStatusChange('not_started')}
              >
                {pendingStatusAction === 'not_started' ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3 mr-1" />
                )}
                {pendingStatusAction === 'not_started' ? 'Resetting...' : 'Reset'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dedicated Rich Text Notes Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Lecture Study Notebook
            </h2>
            <span className="text-[11px] text-zinc-500">
              Autosaves automatically
            </span>
          </div>
        </div>

        <RichTextEditor
          initialContent={initialNote?.content}
          onSave={handleSaveNote}
          lastSavedAt={initialNote?.updated_at}
          placeholder={`Write notes, definitions, important facts, dates, and concepts for ${lecture.title}...`}
          onDelete={initialNote ? handleDeleteNote : undefined}
        />
      </div>
    </div>
  )
}
