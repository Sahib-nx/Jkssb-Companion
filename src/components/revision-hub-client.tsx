'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Subject,
  Lecture,
  RevisionSession,
  LectureRevisionSummary,
} from '@/types/database'
import dynamic from 'next/dynamic'
import { deleteRevisionSession } from '@/app/dashboard/revision/actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  RotateCcw,
  Plus,
  Play,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'

const RevisionCreator = dynamic(
  () => import('@/components/revision-creator').then((m) => m.RevisionCreator),
  {
    loading: () => (
      <div className="p-8 rounded-xl border border-zinc-800 bg-[#11141D] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400 mr-2" />
        <span className="text-sm text-zinc-400">Loading Revision Creator...</span>
      </div>
    ),
    ssr: false,
  }
)

interface RevisionHubClientProps {
  subjects: (Subject & { lectures: Lecture[] })[]
  notesLectureIds: string[]
  inProgressSessions: any[]
  scheduledSessions: {
    overdue: any[]
    dueToday: any[]
    upcoming: any[]
  }
  completedSessions: any[]
  revisionSummaries: LectureRevisionSummary[]
  difficultLectures: LectureRevisionSummary[]
  needsReRevisionLectures: LectureRevisionSummary[]
  totalRevisedLectures: number
  totalRevisionEvents: number
}

export function RevisionHubClient({
  subjects,
  notesLectureIds,
  inProgressSessions,
  scheduledSessions,
  completedSessions,
  revisionSummaries,
  difficultLectures,
  needsReRevisionLectures,
  totalRevisedLectures,
  totalRevisionEvents,
}: RevisionHubClientProps) {
  const toast = useToast()
  const [showCreator, setShowCreator] = useState(false)
  const [activeTab, setActiveTab] = useState<'active' | 'scheduled' | 'difficult' | 'history'>('active')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDeleteSession = async (sessionId: string, title: string) => {
    if (deletingId) return
    const confirmed = window.confirm(`Delete revision session "${title}"?`)
    if (!confirmed) return

    setDeletingId(sessionId)
    try {
      const res = await deleteRevisionSession(sessionId)
      if (res.success) {
        toast.success('Revision session deleted')
      } else {
        toast.error(res.error || 'Failed to delete revision session')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete session')
    } finally {
      setDeletingId(null)
    }
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

  const totalScheduled =
    scheduledSessions.overdue.length +
    scheduledSessions.dueToday.length +
    scheduledSessions.upcoming.length

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Revision Centre
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Systematic revision of existing lecture notes across ranges, subjects, or custom sets
          </p>
        </div>

        <Button
          onClick={() => setShowCreator(!showCreator)}
          className="shrink-0 w-full sm:w-auto min-h-[40px]"
        >
          {showCreator ? (
            <span>Close Creator</span>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Start New Revision</span>
            </>
          )}
        </Button>
      </div>

      {/* Creator Form Toggle */}
      {showCreator && (
        <RevisionCreator
          subjects={subjects}
          notesLectureIds={notesLectureIds}
          onSuccess={() => setShowCreator(false)}
        />
      )}

      {/* Top KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-zinc-800/80 bg-[#11141D]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-zinc-400 uppercase tracking-wider">
              Lectures Revised
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {totalRevisedLectures} <span className="text-xs text-zinc-500 font-normal">/ 255</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Unique lectures revised</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-[#11141D]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-blue-400 uppercase tracking-wider">
              Revision Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {totalRevisionEvents}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Total revisions logged</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-[#11141D]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-red-400 uppercase tracking-wider">
              Difficult Lectures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              {difficultLectures.length}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Flagged for extra attention</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800/80 bg-[#11141D]">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-amber-400 uppercase tracking-wider">
              Re-Revisions Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">
              {needsReRevisionLectures.length}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Marked for another pass</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1 rounded-lg bg-[#0B0D12]/60 border border-white/10 backdrop-blur-sm shrink-0">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-3 py-2 rounded-md text-xs font-medium transition-colors shrink-0 min-h-[36px] ${
            activeTab === 'active'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Active Sessions ({inProgressSessions.length})
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`px-3 py-2 rounded-md text-xs font-medium transition-colors shrink-0 min-h-[36px] ${
            activeTab === 'scheduled'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Scheduled Revisions ({totalScheduled})
        </button>
        <button
          onClick={() => setActiveTab('difficult')}
          className={`px-3 py-2 rounded-md text-xs font-medium transition-colors shrink-0 min-h-[36px] ${
            activeTab === 'difficult'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Difficult & Re-Revisions ({difficultLectures.length + needsReRevisionLectures.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-2 rounded-md text-xs font-medium transition-colors shrink-0 min-h-[36px] ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Full History ({revisionSummaries.length})
        </button>
      </div>

      {/* Tab 1: Active Sessions */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {inProgressSessions.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-[#11141D] border border-zinc-800/80 space-y-3">
              <p className="text-zinc-400 text-sm">No active revision sessions currently in progress.</p>
              <Button size="sm" onClick={() => setShowCreator(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Start a New Revision
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inProgressSessions.map((session) => (
                <Card
                  key={session.id}
                  className="border-zinc-800/80 bg-[#11141D] hover:border-zinc-700/80 transition-all flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="default" className="text-xs capitalize">
                        {session.mode.replace('_', ' ')}
                      </Badge>
                      <span className="text-[11px] text-zinc-500">
                        {formatDate(session.created_at)}
                      </span>
                    </div>
                    <CardTitle className="text-base text-white mt-1">
                      {session.title}
                    </CardTitle>
                    {session.description && (
                      <CardDescription className="text-xs text-zinc-400 line-clamp-2">
                        {session.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60">
                      <Link href={`/dashboard/revision/workspace/${session.id}`}>
                        <Button size="sm" className="h-8 text-xs font-medium">
                          <Play className="w-3.5 h-3.5 mr-1.5" />
                          Resume Workspace
                        </Button>
                      </Link>

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId !== null}
                        onClick={() => handleDeleteSession(session.id, session.title)}
                        className="h-8 px-2 text-zinc-500 hover:text-red-400"
                      >
                        {deletingId === session.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Scheduled Revisions */}
      {activeTab === 'scheduled' && (
        <div className="space-y-6">
          {/* Overdue */}
          {scheduledSessions.overdue.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                  Overdue Revisions ({scheduledSessions.overdue.length})
                </h3>
              </div>
              <div className="space-y-2">
                {scheduledSessions.overdue.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <p className="text-xs text-red-400">
                        Was scheduled for: {formatDate(s.scheduled_date)}
                      </p>
                    </div>
                    <Link href={`/dashboard/revision/workspace/${s.id}`} className="w-full sm:w-auto">
                      <Button size="sm" className="h-9 sm:h-8 text-xs bg-red-600 hover:bg-red-500 w-full sm:w-auto min-h-[36px]">
                        Start Now
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Due Today */}
          {scheduledSessions.dueToday.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                  Due Today ({scheduledSessions.dueToday.length})
                </h3>
              </div>
              <div className="space-y-2">
                {scheduledSessions.dueToday.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <p className="text-xs text-amber-400">Scheduled for today</p>
                    </div>
                    <Link href={`/dashboard/revision/workspace/${s.id}`} className="w-full sm:w-auto">
                      <Button size="sm" className="h-9 sm:h-8 text-xs bg-amber-600 hover:bg-amber-500 w-full sm:w-auto min-h-[36px]">
                        Start Now
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
              Upcoming Scheduled Revisions ({scheduledSessions.upcoming.length})
            </h3>
            {scheduledSessions.upcoming.length === 0 ? (
              <p className="text-xs text-zinc-500">No future revisions scheduled.</p>
            ) : (
              <div className="space-y-2">
                {scheduledSessions.upcoming.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl border border-zinc-800 bg-[#11141D] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{s.title}</p>
                      <p className="text-xs text-zinc-400">
                        Scheduled for: {formatDate(s.scheduled_date)}
                      </p>
                    </div>
                    <Link href={`/dashboard/revision/workspace/${s.id}`} className="w-full sm:w-auto">
                      <Button variant="outline" size="sm" className="h-9 sm:h-8 text-xs border-zinc-800 w-full sm:w-auto min-h-[36px]">
                        Open
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Difficult & Re-Revisions */}
      {activeTab === 'difficult' && (
        <div className="space-y-4">
          {difficultLectures.length === 0 && needsReRevisionLectures.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-[#11141D] border border-zinc-800/80">
              <p className="text-zinc-400 text-sm">
                No lectures flagged as difficult or scheduled for re-revision.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {revisionSummaries
                .filter((s) => s.is_difficult || s.needs_re_revision)
                .map((item) => (
                  <div
                    key={item.lecture.id}
                    className="p-4 rounded-xl border border-zinc-800 bg-[#11141D] flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-white">
                          {item.lecture.title}
                        </span>
                        {item.is_difficult && (
                          <Badge variant="destructive" className="text-[10px]">
                            Difficult
                          </Badge>
                        )}
                        {item.needs_re_revision && (
                          <Badge variant="warning" className="text-[10px]">
                            Re-Revise
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {item.subject.name} &bull; Revised {item.revision_count} time(s)
                      </p>
                      {item.next_revision_date && (
                        <p className="text-[11px] text-amber-400">
                          Next due: {formatDate(item.next_revision_date)}
                        </p>
                      )}
                    </div>

                    <Link href={`/dashboard/lectures/${item.lecture.id}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        Open Notes
                      </Button>
                    </Link>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Full History */}
      {activeTab === 'history' && (
        <div className="space-y-2.5">
          {revisionSummaries.length === 0 ? (
            <div className="p-12 text-center rounded-xl bg-[#11141D] border border-zinc-800/80">
              <p className="text-zinc-400 text-sm">No revision events recorded yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-[#11141D] overflow-hidden">
              <div className="p-3.5 border-b border-zinc-800 bg-[#0E1118] grid grid-cols-12 text-xs font-semibold text-zinc-400 uppercase">
                <span className="col-span-5">Lecture</span>
                <span className="col-span-3">Subject</span>
                <span className="col-span-2 text-center">Revisions</span>
                <span className="col-span-2 text-right">Last Revised</span>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {revisionSummaries.map((item) => (
                  <div
                    key={item.lecture.id}
                    className="p-3.5 grid grid-cols-12 items-center text-xs hover:bg-zinc-800/40"
                  >
                    <div className="col-span-5 flex items-center space-x-2">
                      <span className="text-white font-medium">{item.lecture.title}</span>
                      {item.is_difficult && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="Difficult" />
                      )}
                    </div>
                    <span className="col-span-3 text-zinc-400">{item.subject.name}</span>
                    <span className="col-span-2 text-center font-bold text-blue-400">
                      {item.revision_count}x
                    </span>
                    <span className="col-span-2 text-right text-zinc-500">
                      {formatDate(item.last_revised_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
