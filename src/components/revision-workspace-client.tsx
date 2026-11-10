'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  RevisionSessionWithDetails,
  SessionLectureWithDetails,
} from '@/types/database'
import { recordLectureRevision } from '@/app/dashboard/revision/actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Layers,
  FileText,
  Clock,
  Loader2,
  Check,
  Menu,
  X,
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import LinkExtension from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

interface RevisionWorkspaceClientProps {
  initialSession: RevisionSessionWithDetails
}

// Read-only Tiptap Renderer for existing original notes
function ReadOnlyNoteViewer({ content }: { content: any }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      LinkExtension.configure({ openOnClick: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: content || '',
    editable: false,
    immediatelyRender: false,
  })

  if (!editor) return null

  return (
    <div className="prose prose-invert max-w-none text-zinc-200">
      <EditorContent editor={editor} />
    </div>
  )
}

import { useToast } from '@/components/ui/toast'

export function RevisionWorkspaceClient({
  initialSession,
}: RevisionWorkspaceClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [session, setSession] = useState<RevisionSessionWithDetails>(initialSession)
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Feedback states for current lecture
  const currentItem = session.lectures[currentIndex] || session.lectures[0]
  const [isDifficult, setIsDifficult] = useState<boolean>(currentItem?.is_difficult || false)
  const [needsReRevision, setNeedsReRevision] = useState<boolean>(
    currentItem?.needs_re_revision || false
  )
  const [nextRevisionDate, setNextRevisionDate] = useState<string>('')
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [isPending, startTransition] = useTransition()

  // Sync state when moving between lectures
  const handleSelectLecture = (index: number) => {
    setCurrentIndex(index)
    const target = session.lectures[index]
    if (target) {
      setIsDifficult(target.is_difficult)
      setNeedsReRevision(target.needs_re_revision)
    }
    setShowDatePicker(false)
    setDrawerOpen(false)
  }

  // Handle Mark as Revised
  const handleMarkRevised = (advanceNext = true) => {
    if (isPending || !currentItem) return

    startTransition(async () => {
      try {
        const res = await recordLectureRevision({
          sessionId: session.id,
          lectureId: currentItem.lecture_id,
          isDifficult,
          needsReRevision,
          nextRevisionDate: needsReRevision && nextRevisionDate ? nextRevisionDate : null,
        })

        if (res.success) {
          // Update local session state
          setSession((prev) => {
            const updatedLectures = [...prev.lectures]
            updatedLectures[currentIndex] = {
              ...updatedLectures[currentIndex],
              is_revised: true,
              is_difficult: isDifficult,
              needs_re_revision: needsReRevision,
              revised_at: new Date().toISOString(),
            }
            const revisedCount = updatedLectures.filter((l) => l.is_revised).length
            const progressPercentage = Math.round((revisedCount / updatedLectures.length) * 100)

            return {
              ...prev,
              lectures: updatedLectures,
              revised_count: revisedCount,
              progress_percentage: progressPercentage,
              status: res.allCompleted ? 'completed' : prev.status,
            }
          })

          if (res.allCompleted) {
            toast.success('🎉 Revision session completed!')
          } else {
            toast.success(`Lecture #${currentItem.lecture.lecture_number} marked as revised`)
          }

          if (advanceNext && currentIndex < session.lectures.length - 1) {
            handleSelectLecture(currentIndex + 1)
          }
        } else {
          toast.error(res.error || 'Failed to record revision')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to record revision')
      }
    })
  }

  const hasNotes = Boolean(
    currentItem?.note?.content &&
      currentItem?.note?.plain_text &&
      currentItem.note.plain_text.trim().length > 0
  )

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
      {/* Top Session Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-zinc-400 mb-1.5">
            <Link
              href="/dashboard/revision"
              className="hover:text-white flex items-center transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Revision Centre
            </Link>
            <span>/</span>
            <span className="text-zinc-200 truncate">{session.title}</span>
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
            <h1 className="text-xl font-bold tracking-tight text-white">
              {session.title}
            </h1>
            {session.subject && (
              <Badge variant="outline" className="text-xs">
                {session.subject.name}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs capitalize">
              {session.mode.replace('_', ' ')}
            </Badge>
            {session.status === 'completed' && (
              <Badge variant="success">Completed</Badge>
            )}
          </div>
        </div>

        {/* Overview Drawer Toggle */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="text-xs shrink-0 border-zinc-800"
        >
          <Layers className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
          <span>Lecture Overview ({session.revised_count}/{session.total_lectures})</span>
        </Button>
      </div>

      {/* Progress Bar through the session */}
      <div className="p-3.5 rounded-xl bg-[#11141D] border border-zinc-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-300 font-medium">
            Lecture {currentIndex + 1} of {session.total_lectures} &bull;{' '}
            <strong className="text-white">{currentItem?.lecture.title}</strong>
          </span>
          <span className="text-blue-400 font-semibold">
            {session.progress_percentage}% Revised ({session.revised_count}/{session.total_lectures})
          </span>
        </div>
        <Progress
          value={session.progress_percentage}
          className="h-2"
          indicatorClassName="bg-gradient-to-r from-blue-600 to-emerald-500"
        />
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Side: Dedicated Notes Reading Area (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-xl border border-zinc-800/80 bg-[#11141D] overflow-hidden">
            {/* Header with Lecture Info and Status */}
            <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-[#0E1118] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2 text-xs text-zinc-400 mb-1">
                  <span>{currentItem?.subject.name}</span>
                  <span>&bull;</span>
                  <span>Lecture #{currentItem?.lecture.lecture_number}</span>
                </div>
                <h2 className="text-lg font-bold text-white">
                  {currentItem?.lecture.title}
                </h2>
              </div>

              <div className="flex items-center space-x-2">
                {currentItem?.is_revised && (
                  <Badge variant="success">
                    <Check className="w-3 h-3 mr-1" />
                    Revised
                  </Badge>
                )}
                {currentItem?.is_difficult && (
                  <Badge variant="destructive">Difficult</Badge>
                )}
                {currentItem?.needs_re_revision && (
                  <Badge variant="warning">Needs Re-Revision</Badge>
                )}
              </div>
            </div>

            {/* Reading Canvas: Reusing Original Notes */}
            <div className="p-6 sm:p-8 min-h-[360px]">
              {hasNotes ? (
                <div className="space-y-4">
                  <div className="text-[11px] text-zinc-500 border-b border-zinc-800/60 pb-2">
                    Original study notes &bull; Last updated {formatDate(currentItem.note?.updated_at)}
                  </div>
                  <ReadOnlyNoteViewer content={currentItem.note?.content} />
                </div>
              ) : (
                <div className="p-12 text-center rounded-xl bg-[#0B0D12] border border-zinc-800/60 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-zinc-400 mx-auto">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    No Notes Recorded for this Lecture
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    You haven&apos;t written study notes for {currentItem?.lecture.title} yet. You can still revise concepts or write notes on the dedicated lecture page.
                  </p>
                  <Link
                    href={`/dashboard/lectures/${currentItem?.lecture_id}`}
                    target="_blank"
                    className="inline-block pt-1"
                  >
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Write Notes for this Lecture
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Bottom Workspace Action Bar */}
            <div className="p-4 border-t border-zinc-800/80 bg-[#0E1118] flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Prev / Next controls */}
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-start">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => handleSelectLecture(currentIndex - 1)}
                  className="h-8 text-xs border-zinc-800"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Prev
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentIndex === session.lectures.length - 1}
                  onClick={() => handleSelectLecture(currentIndex + 1)}
                  className="h-8 text-xs border-zinc-800"
                >
                  Next
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>

              {/* Revision Feedback Buttons */}
              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end flex-wrap gap-y-2">
                {/* Mark as Difficult toggle */}
                <Button
                  variant={isDifficult ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => setIsDifficult(!isDifficult)}
                  className="h-8 text-xs border-zinc-800"
                  title="Flag as difficult to review again later"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                  {isDifficult ? 'Difficult ✓' : 'Mark Difficult'}
                </Button>

                {/* Mark for Re-Revision toggle */}
                <Button
                  variant={needsReRevision ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setNeedsReRevision(!needsReRevision)
                    setShowDatePicker(!needsReRevision)
                  }}
                  className={`h-8 text-xs border-zinc-800 ${
                    needsReRevision ? 'text-amber-300 border-amber-500/40' : ''
                  }`}
                  title="Schedule another revision for this lecture"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  {needsReRevision ? 'Re-Revise ✓' : 'Need Re-Revision'}
                </Button>

                {/* Mark as Revised & Advance */}
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleMarkRevised(true)}
                  className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 font-semibold"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  )}
                  {isPending ? 'Recording...' : 'Mark as Revised'}
                </Button>
              </div>
            </div>

            {/* Optional Date Picker for Re-Revision */}
            {showDatePicker && (
              <div className="p-3 bg-[#0B0D12] border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-zinc-300">
                  Target date for next revision of {currentItem?.lecture.title}:
                </span>
                <input
                  type="date"
                  value={nextRevisionDate}
                  onChange={(e) => setNextRevisionDate(e.target.value)}
                  className="h-8 rounded-lg border border-zinc-700 bg-[#11141D] px-2.5 text-xs text-zinc-100"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Lecture Selection Overview (1 Col) */}
        <div
          className={`rounded-xl border border-zinc-800/80 bg-[#11141D] overflow-hidden lg:block ${
            drawerOpen ? 'block' : 'hidden'
          }`}
        >
          <div className="p-3.5 border-b border-zinc-800/80 bg-[#0E1118] flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Lecture List ({session.total_lectures})
            </h3>
            <span className="text-[11px] text-zinc-500">
              {session.revised_count} revised
            </span>
          </div>

          <div className="max-h-[500px] overflow-y-auto p-2 space-y-1">
            {session.lectures.map((item, idx) => {
              const isSelected = idx === currentIndex
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectLecture(idx)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'hover:bg-zinc-800/70 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate pr-2">
                    <span className="text-[11px] opacity-70">#{item.order_index + 1}</span>
                    <span className="truncate">{item.lecture.title}</span>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {item.is_revised ? (
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          isSelected ? 'text-white' : 'text-emerald-400'
                        }`}
                      />
                    ) : (
                      <Clock
                        className={`w-3.5 h-3.5 ${
                          isSelected ? 'text-white' : 'text-zinc-600'
                        }`}
                      />
                    )}
                    {item.is_difficult && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="Difficult" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
