'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import {
  Subject,
  SubjectWithStats,
  LectureWithProgress,
} from '@/types/database'
import { updateLectureProgress, type TargetStatus } from '@/app/dashboard/tracker/actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  CheckCircle2,
  Clock,
  Circle,
  RotateCcw,
  Play,
  Check,
  Search,
  Loader2,
  Calendar,
  BookText,
} from 'lucide-react'

import { useToast } from '@/components/ui/toast'

interface LectureTrackerClientProps {
  subjects: SubjectWithStats[]
  allLecturesBySubject?: Record<string, LectureWithProgress[]>
  overallPercentage: number
  initialSubjectSlug?: string
  activeSubject?: SubjectWithStats
  lectures?: LectureWithProgress[]
}

export function LectureTrackerClient({
  subjects,
  allLecturesBySubject,
  overallPercentage,
  initialSubjectSlug,
  activeSubject: fallbackActiveSubject,
  lectures: fallbackLectures,
}: LectureTrackerClientProps) {
  const toast = useToast()
  const [activeSubjectSlug, setActiveSubjectSlug] = useState<string>(
    initialSubjectSlug || fallbackActiveSubject?.slug || subjects[0]?.slug || 'general-knowledge'
  )
  const [lecturesMap, setLecturesMap] = useState<Record<string, LectureWithProgress[]>>(
    allLecturesBySubject || (fallbackActiveSubject && fallbackLectures ? { [fallbackActiveSubject.slug]: fallbackLectures } : {})
  )
  const [filter, setFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingLectureId, setPendingLectureId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Instant subject switch with zero network delay & URL synchronization
  const handleSubjectChange = (slug: string) => {
    if (slug === activeSubjectSlug) return
    setActiveSubjectSlug(slug)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('subject', slug)
      window.history.replaceState(null, '', url.toString())
    }
  }

  const currentLectures = lecturesMap[activeSubjectSlug] || []
  const baseActiveSubject = subjects.find((s) => s.slug === activeSubjectSlug) || subjects[0]
  const completedCount = currentLectures.filter((l) => l.progress?.status === 'completed').length
  const inProgressCount = currentLectures.filter((l) => l.progress?.status === 'in_progress').length
  const total = baseActiveSubject.total_lectures
  const remainingCount = Math.max(0, total - completedCount)
  const subjectPercentage = total > 0 ? Math.round((completedCount / total) * 100) : 0

  const activeSubject: SubjectWithStats = {
    ...baseActiveSubject,
    completed_count: completedCount,
    in_progress_count: inProgressCount,
    remaining_count: remainingCount,
    progress_percentage: subjectPercentage,
  }

  // Handle status update with optimistic UI & rollback on error
  const handleStatusChange = (lectureId: string, targetStatus: TargetStatus) => {
    if (pendingLectureId) return
    setPendingLectureId(lectureId)

    const prevMap = lecturesMap
    setLecturesMap((prev) => {
      const list = prev[activeSubjectSlug] || []
      const updated = list.map((lec) => {
        if (lec.id === lectureId) {
          const newStatus = targetStatus === 'not_started' ? null : targetStatus
          return {
            ...lec,
            progress: newStatus
              ? {
                  id: lec.progress?.id || 'temp-' + Date.now(),
                  user_id: lec.progress?.user_id || '',
                  lecture_id: lectureId,
                  status: newStatus as any,
                  started_at: lec.progress?.started_at || new Date().toISOString(),
                  completed_at: targetStatus === 'completed' ? new Date().toISOString() : null,
                  updated_at: new Date().toISOString(),
                }
              : null,
          }
        }
        return lec
      })
      return { ...prev, [activeSubjectSlug]: updated }
    })

    startTransition(async () => {
      try {
        const res = await updateLectureProgress(lectureId, targetStatus)
        if (res.success) {
          if (targetStatus === 'completed') {
            toast.success('Lecture marked as completed!')
          } else if (targetStatus === 'in_progress') {
            toast.info('Lecture marked as in progress')
          } else {
            toast.info('Lecture reset to not started')
          }
        } else {
          setLecturesMap(prevMap)
          toast.error(res.error || 'Failed to update lecture status')
        }
      } catch (err: any) {
        setLecturesMap(prevMap)
        toast.error(err?.message || 'Failed to update lecture status')
      } finally {
        setPendingLectureId(null)
      }
    })
  }

  // Filter lectures based on status and search query
  const filteredLectures = useMemo(() => {
    return currentLectures.filter((lec) => {
      const status = lec.progress?.status || 'not_started'

      if (filter === 'not_started' && status !== 'not_started') return false
      if (filter === 'in_progress' && status !== 'in_progress') return false
      if (filter === 'completed' && status !== 'completed') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const titleMatch = lec.title.toLowerCase().includes(q)
        const numMatch = lec.lecture_number.toString().includes(q)
        return titleMatch || numMatch
      }

      return true
    })
  }, [currentLectures, filter, searchQuery])

  // Format date helper
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
      {/* Subject Navigation Tabs with Instant Switching */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-3 border-b border-zinc-800/80 -mx-1 px-1 sm:mx-0 sm:px-0">
        {subjects.map((sub) => {
          const isActive = sub.slug === activeSubjectSlug
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => handleSubjectChange(sub.slug)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex items-center space-x-2 shrink-0 min-h-[40px] cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold ring-1 ring-blue-400/40'
                  : 'bg-[#11141D] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 active:scale-[0.98]'
              }`}
            >
              <span>{sub.name}</span>
              <span
                className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${
                  isActive ? 'bg-blue-700 text-blue-100' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {sub.total_lectures}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active Subject Banner & Progress */}
      <Card className="border-zinc-800/80 bg-[#11141D]">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <CardTitle className="text-xl text-white">{activeSubject.name}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {activeSubject.total_lectures} Total Lectures
                </Badge>
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                JKSSB Syllabus &bull; Overall prep progress: {overallPercentage}%
              </CardDescription>
            </div>

            <div className="flex items-center space-x-6">
              <div className="text-right">
                <span className="text-2xl font-bold text-blue-400">
                  {activeSubject.progress_percentage}%
                </span>
                <p className="text-[11px] text-zinc-400">Subject Completed</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress
            value={activeSubject.progress_percentage}
            className="h-2.5"
            indicatorClassName="bg-gradient-to-r from-blue-600 to-emerald-500"
          />

          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-2.5 rounded-lg bg-[#0B0D12] border border-zinc-800/60">
              <span className="text-xs text-zinc-400 block mb-0.5">Completed</span>
              <span className="text-lg font-bold text-emerald-400">
                {activeSubject.completed_count}
              </span>
              <span className="text-[11px] text-zinc-400 block">
                / {activeSubject.total_lectures}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0B0D12] border border-zinc-800/60">
              <span className="text-xs text-zinc-400 block mb-0.5">In Progress</span>
              <span className="text-lg font-bold text-amber-400">
                {activeSubject.in_progress_count}
              </span>
              <span className="text-[11px] text-zinc-400 block">lectures</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#0B0D12] border border-zinc-800/60">
              <span className="text-xs text-zinc-400 block mb-0.5">Remaining</span>
              <span className="text-lg font-bold text-zinc-300">
                {activeSubject.remaining_count}
              </span>
              <span className="text-[11px] text-zinc-400 block">unwatched</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center space-x-1.5 p-1 rounded-lg bg-[#0B0D12]/60 border border-white/10 backdrop-blur-sm overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All ({currentLectures.length})
          </button>
          <button
            onClick={() => setFilter('not_started')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              filter === 'not_started'
                ? 'bg-zinc-700 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Not Started ({activeSubject.remaining_count})
          </button>
          <button
            onClick={() => setFilter('in_progress')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              filter === 'in_progress'
                ? 'bg-amber-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            In Progress ({activeSubject.in_progress_count})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              filter === 'completed'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Completed ({activeSubject.completed_count})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search lecture #..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Lectures List */}
      <div className="space-y-2.5">
        {filteredLectures.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-[#0B0D12]/55 border border-white/10 backdrop-blur-md">
            <p className="text-zinc-400 text-sm">No lectures found matching your criteria.</p>
          </div>
        ) : (
          filteredLectures.map((lecture) => {
            const status = lecture.progress?.status || 'not_started'
            const isRowPending = isPending && pendingLectureId === lecture.id

            return (
              <div
                key={lecture.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border backdrop-blur-sm transition-all ${
                  status === 'completed'
                    ? 'bg-[#0B0D12]/60 border-emerald-500/25 shadow-lg shadow-emerald-500/5'
                    : status === 'in_progress'
                    ? 'bg-[#0B0D12]/60 border-amber-500/30 shadow-lg shadow-amber-500/5'
                    : 'bg-[#0B0D12]/55 border-white/10 hover:border-white/20 shadow-md'
                }`}
              >
                {/* Left side: Lecture Number, Title & Timestamp info */}
                <div className="flex items-start space-x-3.5 mb-3 sm:mb-0">
                  <div className="pt-0.5 shrink-0">
                    {status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : status === 'in_progress' ? (
                      <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                    ) : (
                      <Circle className="w-5 h-5 text-zinc-600" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2.5">
                      <h4 className="text-sm font-semibold text-white">
                        {lecture.title}
                      </h4>
                      {status === 'completed' && (
                        <Badge variant="success">Completed</Badge>
                      )}
                      {status === 'in_progress' && (
                        <Badge variant="warning">In Progress</Badge>
                      )}
                      {status === 'not_started' && (
                        <Badge variant="secondary">Not Started</Badge>
                      )}
                    </div>

                    {/* Timestamp Details */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-400 mt-1">
                      {lecture.progress?.started_at && (
                        <span className="inline-flex items-center">
                          <Calendar className="w-3 h-3 mr-1 text-zinc-400" />
                          Started: {formatDate(lecture.progress.started_at)}
                        </span>
                      )}
                      {lecture.progress?.completed_at && (
                        <span className="inline-flex items-center text-emerald-400">
                          <Check className="w-3 h-3 mr-1" />
                          Completed: {formatDate(lecture.progress.completed_at)}
                        </span>
                      )}
                      {!lecture.progress && (
                        <span>Ready to begin</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Action Controls */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2.5 sm:pt-0 border-t border-zinc-800/40 sm:border-0 justify-end sm:justify-start shrink-0 w-full sm:w-auto">
                  <Link href={`/dashboard/lectures/${lecture.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 min-h-[36px] text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 px-2.5"
                      title="Open Dedicated Notes"
                    >
                      <BookText className="w-3.5 h-3.5 mr-1" />
                      Notes
                    </Button>
                  </Link>

                  {isRowPending ? (
                    <Button variant="outline" size="sm" disabled className="h-8 min-h-[36px] text-xs">
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Updating...
                    </Button>
                  ) : (
                    <>
                      {/* State: Not Started */}
                      {status === 'not_started' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 min-h-[36px] text-xs text-amber-300 hover:text-amber-200"
                            onClick={() => handleStatusChange(lecture.id, 'in_progress')}
                          >
                            <Play className="w-3 h-3 mr-1.5" />
                            Start
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 min-h-[36px] text-xs bg-emerald-600 hover:bg-emerald-500"
                            onClick={() => handleStatusChange(lecture.id, 'completed')}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Complete
                          </Button>
                        </>
                      )}

                      {/* State: In Progress */}
                      {status === 'in_progress' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 min-h-[36px] text-xs text-zinc-400 hover:text-zinc-200"
                            onClick={() => handleStatusChange(lecture.id, 'not_started')}
                            title="Reset to Not Started"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reset
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 min-h-[36px] text-xs bg-emerald-600 hover:bg-emerald-500"
                            onClick={() => handleStatusChange(lecture.id, 'completed')}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" />
                            Complete
                          </Button>
                        </>
                      )}

                      {/* State: Completed */}
                      {status === 'completed' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 min-h-[36px] text-xs text-zinc-400 hover:text-amber-400 hover:border-amber-500/30"
                            onClick={() => handleStatusChange(lecture.id, 'in_progress')}
                            title="Reopen to In Progress (preserves started_at)"
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Reopen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 min-h-[36px] text-xs text-zinc-400 hover:text-red-400 hover:border-red-500/30"
                            onClick={() => handleStatusChange(lecture.id, 'not_started')}
                            title="Reset to Not Started"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reset
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
