'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Subject, Lecture, LectureProgress, LectureNote } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  BookText,
  Search,
  CheckCircle2,
  Clock,
  Circle,
  ArrowRight,
  FileText,
  Calendar,
} from 'lucide-react'

export type LectureWithNoteDetails = Lecture & {
  progress: LectureProgress | null
  note: LectureNote | null
}

interface LectureNotesDirectoryClientProps {
  subjects: Subject[]
  allLecturesBySubject?: Record<string, LectureWithNoteDetails[]>
  notesCountBySubject?: Record<string, number>
  initialSubjectSlug?: string
  activeSubject?: Subject
  lectures?: LectureWithNoteDetails[]
  notesCount?: number
  totalLectures?: number
}

export function LectureNotesDirectoryClient({
  subjects,
  allLecturesBySubject,
  notesCountBySubject,
  initialSubjectSlug,
  activeSubject: fallbackActiveSubject,
  lectures: fallbackLectures,
  notesCount: fallbackNotesCount,
  totalLectures: fallbackTotalLectures,
}: LectureNotesDirectoryClientProps) {
  const [activeSubjectSlug, setActiveSubjectSlug] = useState<string>(
    initialSubjectSlug || fallbackActiveSubject?.slug || subjects[0]?.slug || 'general-knowledge'
  )
  const [filter, setFilter] = useState<'all' | 'has_notes' | 'no_notes'>('all')
  const [searchQuery, setSearchQuery] = useState('')

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

  const activeSubject =
    subjects.find((s) => s.slug === activeSubjectSlug) || fallbackActiveSubject || subjects[0]
  const currentLectures =
    (allLecturesBySubject && allLecturesBySubject[activeSubjectSlug]) || fallbackLectures || []
  const currentNotesCount =
    notesCountBySubject && notesCountBySubject[activeSubjectSlug] !== undefined
      ? notesCountBySubject[activeSubjectSlug]
      : (fallbackNotesCount ?? 0)
  const totalLectures =
    activeSubject.total_lectures || fallbackTotalLectures || currentLectures.length

  const notesPercentage =
    totalLectures > 0 ? Math.round((currentNotesCount / totalLectures) * 100) : 0

  const filteredLectures = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return currentLectures.filter((lec) => {
      const hasNote = Boolean(lec.note && (lec.note.plain_text?.trim()?.length ?? 0) > 0)

      if (filter === 'has_notes' && !hasNote) return false
      if (filter === 'no_notes' && hasNote) return false

      if (q) {
        const titleMatch = lec.title.toLowerCase().includes(q)
        const numMatch = lec.lecture_number.toString().includes(q)
        const textMatch = lec.note?.plain_text?.toLowerCase().includes(q)
        return titleMatch || numMatch || textMatch
      }

      return true
    })
  }, [currentLectures, filter, searchQuery])

  const formatDate = useCallback((dateStr?: string | null) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return ''
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Subject Navigation Tabs with Instant Switching */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 border-b border-zinc-800/80 pb-3 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 sm:flex-wrap">
        {subjects.map((sub) => {
          const isActive = sub.slug === activeSubjectSlug
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => handleSubjectChange(sub.slug)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 flex items-center space-x-2 shrink-0 min-h-[38px] cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold ring-1 ring-blue-400/40'
                  : 'bg-[#11141D] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700 active:scale-[0.98]'
              }`}
            >
              <span>{sub.name}</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  isActive ? 'bg-blue-700 text-blue-100' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {sub.total_lectures}
              </span>
            </button>
          )
        })}
      </div>

      {/* Notes Progress Overview Card */}
      <Card className="border-zinc-800/80 bg-[#11141D]">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg text-white">
                {activeSubject.name} — Study Notes Directory
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                {currentNotesCount} of {totalLectures} lectures have study notes recorded
              </CardDescription>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-blue-400">{notesPercentage}%</span>
              <p className="text-[11px] text-zinc-400">Notes Coverage</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Progress
            value={notesPercentage}
            className="h-2.5"
            indicatorClassName="bg-gradient-to-r from-blue-600 to-indigo-400"
          />
        </CardContent>
      </Card>

      {/* Search and Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1 rounded-lg bg-[#0B0D12]/60 border border-white/10 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 min-h-[34px] ${
              filter === 'all'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All ({currentLectures.length})
          </button>
          <button
            onClick={() => setFilter('has_notes')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 min-h-[34px] ${
              filter === 'has_notes'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Has Notes ({currentNotesCount})
          </button>
          <button
            onClick={() => setFilter('no_notes')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 min-h-[34px] ${
              filter === 'no_notes'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            No Notes Yet ({Math.max(0, totalLectures - currentNotesCount)})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes or lecture #..."
            className="pl-9 h-10 sm:h-9 text-xs"
          />
        </div>
      </div>

      {/* Lecture Notes Cards List */}
      <div className="space-y-2.5">
        {filteredLectures.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-[#0B0D12]/55 border border-white/10 backdrop-blur-md">
            <p className="text-zinc-400 text-sm">No lecture notes found matching your filter.</p>
          </div>
        ) : (
          filteredLectures.map((lecture) => {
            const hasNote = Boolean(
              lecture.note && (lecture.note.plain_text?.trim()?.length ?? 0) > 0
            )
            const status = lecture.progress?.status || 'not_started'
            const snippet = lecture.note?.plain_text?.slice(0, 160)?.trim()

            return (
              <div
                key={lecture.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-white/10 bg-[#0B0D12]/55 hover:border-white/20 backdrop-blur-sm shadow-md transition-all gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                  <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                    <span className="text-sm font-semibold text-white">
                      {lecture.title}
                    </span>

                    {/* Progress Status Badge */}
                    {status === 'completed' && (
                      <Badge variant="success">Completed</Badge>
                    )}
                    {status === 'in_progress' && (
                      <Badge variant="warning">In Progress</Badge>
                    )}
                    {status === 'not_started' && (
                      <Badge variant="secondary">Not Started</Badge>
                    )}

                    {/* Notes Status Badge */}
                    {hasNote ? (
                      <Badge variant="default" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        <FileText className="w-3 h-3 mr-1" />
                        Notes Saved
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-zinc-500">No notes written</span>
                    )}
                  </div>

                  {/* Notes Snippet */}
                  {hasNote && snippet && (
                    <p className="text-xs text-zinc-400 line-clamp-2">
                      {snippet}...
                    </p>
                  )}

                  {hasNote && lecture.note?.updated_at && (
                    <p className="text-[11px] text-zinc-500">
                      Last edited: {formatDate(lecture.note.updated_at)}
                    </p>
                  )}
                </div>

                <Link
                  href={`/dashboard/lectures/${lecture.id}`}
                  className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0"
                >
                  <Button
                    variant={hasNote ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-9 sm:h-8 text-xs font-medium w-full sm:w-auto min-h-[36px]"
                  >
                    <span>{hasNote ? 'Open Notes' : 'Write Notes'}</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
