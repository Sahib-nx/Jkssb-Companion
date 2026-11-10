'use client'

import { useState } from 'react'
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

type LectureWithNoteDetails = Lecture & {
  progress: LectureProgress | null
  note: LectureNote | null
}

interface LectureNotesDirectoryClientProps {
  subjects: Subject[]
  activeSubject: Subject
  lectures: LectureWithNoteDetails[]
  notesCount: number
  totalLectures: number
}

export function LectureNotesDirectoryClient({
  subjects,
  activeSubject,
  lectures,
  notesCount,
  totalLectures,
}: LectureNotesDirectoryClientProps) {
  const [filter, setFilter] = useState<'all' | 'has_notes' | 'no_notes'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const notesPercentage =
    totalLectures > 0 ? Math.round((notesCount / totalLectures) * 100) : 0

  const filteredLectures = lectures.filter((lec) => {
    const hasNote = Boolean(lec.note && (lec.note.plain_text?.trim()?.length ?? 0) > 0)

    if (filter === 'has_notes' && !hasNote) return false
    if (filter === 'no_notes' && hasNote) return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const titleMatch = lec.title.toLowerCase().includes(q)
      const numMatch = lec.lecture_number.toString().includes(q)
      const textMatch = lec.note?.plain_text?.toLowerCase().includes(q)
      return titleMatch || numMatch || textMatch
    }

    return true
  })

  const formatDate = (dateStr?: string | null) => {
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
  }

  return (
    <div className="space-y-6">
      {/* Subject Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800/80 pb-3">
        {subjects.map((sub) => {
          const isActive = sub.slug === activeSubject.slug
          return (
            <Link
              key={sub.id}
              href={`/dashboard/lecture-notes?subject=${sub.slug}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold'
                  : 'bg-[#11141D] text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <span>{sub.name}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isActive ? 'bg-blue-700 text-blue-100' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {sub.total_lectures}
              </span>
            </Link>
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
                {notesCount} of {totalLectures} lectures have study notes recorded
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
        <div className="flex gap-1.5 p-1 rounded-lg bg-[#11141D] border border-zinc-800">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All ({lectures.length})
          </button>
          <button
            onClick={() => setFilter('has_notes')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'has_notes'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Has Notes ({notesCount})
          </button>
          <button
            onClick={() => setFilter('no_notes')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filter === 'no_notes'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            No Notes Yet ({totalLectures - notesCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes or lecture #..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Lecture Notes Cards List */}
      <div className="space-y-2.5">
        {filteredLectures.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-[#11141D] border border-zinc-800/80">
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
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-zinc-800/80 bg-[#11141D] hover:border-zinc-700/80 transition-all gap-3"
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
                  className="shrink-0 self-end sm:self-center"
                >
                  <Button
                    variant={hasNote ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-8 text-xs font-medium"
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
