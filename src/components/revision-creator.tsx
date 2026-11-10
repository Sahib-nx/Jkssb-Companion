'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Subject, Lecture, RevisionMode } from '@/types/database'
import { createRevisionSession } from '@/app/dashboard/revision/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Calendar,
  Layers,
  ListFilter,
  BookOpen,
  Check,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react'

import { useToast } from '@/components/ui/toast'

interface RevisionCreatorProps {
  subjects: (Subject & { lectures: Lecture[] })[]
  notesLectureIds: string[]
  onSuccess?: () => void
}

export function RevisionCreator({
  subjects,
  notesLectureIds,
  onSuccess,
}: RevisionCreatorProps) {
  const router = useRouter()
  const toast = useToast()
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '')
  const [mode, setMode] = useState<RevisionMode>('range')
  const [title, setTitle] = useState('')

  // Mode B: Range
  const [startNum, setStartNum] = useState<number>(1)
  const [endNum, setEndNum] = useState<number>(20)

  // Mode A: Single
  const [singleLectureId, setSingleLectureId] = useState<string>('')

  // Mode D: Custom
  const [customSelectedIds, setCustomSelectedIds] = useState<string[]>([])

  // Mode E: Scheduling
  const [isScheduled, setIsScheduled] = useState(false)
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  )
  const [description, setDescription] = useState('')

  const [isCreating, startTransition] = useTransition()

  const currentSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0]
  const subjectLectures = currentSubject?.lectures || []

  // Calculate selected lectures based on mode
  let selectedLectures: Lecture[] = []

  if (mode === 'single') {
    const found = subjectLectures.find((l) => l.id === (singleLectureId || subjectLectures[0]?.id))
    selectedLectures = found ? [found] : []
  } else if (mode === 'range') {
    const min = Math.min(startNum, endNum)
    const max = Math.max(startNum, endNum)
    selectedLectures = subjectLectures.filter(
      (l) => l.lecture_number >= min && l.lecture_number <= max
    )
  } else if (mode === 'entire_subject') {
    selectedLectures = subjectLectures
  } else if (mode === 'custom') {
    selectedLectures = subjectLectures.filter((l) => customSelectedIds.includes(l.id))
  }

  // Count how many have saved notes
  const notesSet = new Set(notesLectureIds)
  const lecturesWithNotesCount = selectedLectures.filter((l) => notesSet.has(l.id)).length

  // Suggested default title
  const getDefaultTitle = () => {
    if (mode === 'single' && selectedLectures[0]) {
      return `Revise: ${currentSubject?.name} — ${selectedLectures[0].title}`
    }
    if (mode === 'range') {
      const min = Math.min(startNum, endNum)
      const max = Math.max(startNum, endNum)
      return `${currentSubject?.name}: Lectures ${String(min).padStart(3, '0')}–${String(max).padStart(3, '0')}`
    }
    if (mode === 'entire_subject') {
      return `Full Revision: ${currentSubject?.name} (All ${currentSubject?.total_lectures})`
    }
    if (mode === 'custom') {
      return `Custom Revision: ${currentSubject?.name} (${selectedLectures.length} Lectures)`
    }
    return `Revision Session`
  }

  // Handle Submit
  const handleStartRevision = () => {
    if (isCreating) return
    if (selectedLectures.length === 0) {
      toast.error('Please select at least one lecture.')
      return
    }

    const sessionTitle = title.trim() || getDefaultTitle()

    startTransition(async () => {
      try {
        const res = await createRevisionSession({
          title: sessionTitle,
          subjectId: currentSubject.id,
          mode,
          lectureIds: selectedLectures.map((l) => l.id),
          scheduledDate: isScheduled ? scheduledDate : null,
          description: description.trim() || null,
        })

        if (res.success && res.sessionId) {
          if (onSuccess) onSuccess()
          if (isScheduled) {
            toast.success('Revision session scheduled successfully')
            router.push('/dashboard/revision?tab=scheduled')
          } else {
            toast.success('Revision session created')
            router.push(`/dashboard/revision/workspace/${res.sessionId}`)
          }
        } else {
          toast.error(res.error || 'Failed to start revision session')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to start revision session')
      }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-[#11141D] p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-zinc-800/70 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Create Revision Session</h3>
            <p className="text-xs text-zinc-400">Configure what lectures you want to revise</p>
          </div>
        </div>
      </div>

      {/* 1. Subject Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-300">Choose Subject</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {subjects.map((sub) => {
            const isSelected = sub.id === selectedSubjectId
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => {
                  setSelectedSubjectId(sub.id)
                  setCustomSelectedIds([])
                  setSingleLectureId(sub.lectures[0]?.id || '')
                }}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-blue-600/15 border-blue-500/40 text-white font-medium'
                    : 'bg-[#0E1118] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <div className="text-xs font-medium truncate">{sub.name}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {sub.total_lectures} lectures
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. Revision Method Tabs */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-zinc-300">Revision Method</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setMode('range')}
            className={`p-2.5 rounded-lg border text-center transition-all ${
              mode === 'range'
                ? 'bg-blue-600/20 border-blue-500 text-white font-medium'
                : 'bg-[#0E1118] border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 mx-auto mb-1 text-blue-400" />
            <span className="text-xs block">Lecture Range</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('entire_subject')}
            className={`p-2.5 rounded-lg border text-center transition-all ${
              mode === 'entire_subject'
                ? 'bg-blue-600/20 border-blue-500 text-white font-medium'
                : 'bg-[#0E1118] border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 mx-auto mb-1 text-blue-400" />
            <span className="text-xs block">Entire Subject</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`p-2.5 rounded-lg border text-center transition-all ${
              mode === 'custom'
                ? 'bg-blue-600/20 border-blue-500 text-white font-medium'
                : 'bg-[#0E1118] border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <ListFilter className="w-4 h-4 mx-auto mb-1 text-blue-400" />
            <span className="text-xs block">Custom Pick</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('single')}
            className={`p-2.5 rounded-lg border text-center transition-all ${
              mode === 'single'
                ? 'bg-blue-600/20 border-blue-500 text-white font-medium'
                : 'bg-[#0E1118] border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Play className="w-4 h-4 mx-auto mb-1 text-blue-400" />
            <span className="text-xs block">Single Lecture</span>
          </button>
        </div>
      </div>

      {/* 3. Method-specific inputs */}
      <div className="p-3.5 rounded-lg bg-[#0E1118] border border-zinc-800/80">
        {mode === 'range' && (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full sm:w-1/2 space-y-1">
                <label className="text-xs text-zinc-400">Start Lecture #</label>
                <Input
                  type="number"
                  min={1}
                  max={currentSubject?.total_lectures || 151}
                  value={startNum}
                  onChange={(e) => setStartNum(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="w-full sm:w-1/2 space-y-1">
                <label className="text-xs text-zinc-400">End Lecture #</label>
                <Input
                  type="number"
                  min={1}
                  max={currentSubject?.total_lectures || 151}
                  value={endNum}
                  onChange={(e) => setEndNum(Number(e.target.value))}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <p className="text-[11px] text-zinc-400">
              Valid range: 1 to {currentSubject?.total_lectures} for {currentSubject?.name}.
            </p>
          </div>
        )}

        {mode === 'entire_subject' && (
          <div className="text-xs text-zinc-300">
            Will include all <strong className="text-white">{currentSubject?.total_lectures}</strong>{' '}
            lectures of {currentSubject?.name} in numerical order.
          </div>
        )}

        {mode === 'single' && (
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400">Select Lecture</label>
            <select
              value={singleLectureId || subjectLectures[0]?.id || ''}
              onChange={(e) => setSingleLectureId(e.target.value)}
              className="w-full h-9 rounded-lg border border-zinc-700 bg-[#11141D] px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {subjectLectures.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title} {notesSet.has(l.id) ? '✓ (Has notes)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'custom' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 pb-1 border-b border-zinc-800">
              <span>Check individual lectures to include:</span>
              <span>{customSelectedIds.length} selected</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {subjectLectures.map((lec) => {
                const isChecked = customSelectedIds.includes(lec.id)
                return (
                  <label
                    key={lec.id}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer text-xs ${
                      isChecked ? 'bg-blue-600/15 text-white' : 'hover:bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCustomSelectedIds((prev) => [...prev, lec.id])
                          } else {
                            setCustomSelectedIds((prev) => prev.filter((id) => id !== lec.id))
                          }
                        }}
                        className="rounded accent-blue-600"
                      />
                      <span>{lec.title}</span>
                    </div>
                    {notesSet.has(lec.id) && (
                      <Badge variant="default" className="text-[10px] py-0">
                        Notes Saved
                      </Badge>
                    )}
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Scheduling Toggle */}
      <div className="pt-2 border-t border-zinc-800/60 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-300">
              Schedule for a Future Date?
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsScheduled(!isScheduled)}
            className={`w-9 h-5 rounded-full transition-colors relative ${
              isScheduled ? 'bg-blue-600' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                isScheduled ? 'left-5' : 'left-1'
              }`}
            />
          </button>
        </div>

        {isScheduled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-[#0E1118] border border-zinc-800">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Scheduled Date</label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Optional Reminder Note</label>
              <Input
                type="text"
                placeholder="e.g. Rapid revision before weekend test"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. Custom Session Title (Optional) */}
      <div className="space-y-1">
        <label className="text-xs text-zinc-400">Session Title (Optional)</label>
        <Input
          placeholder={getDefaultTitle()}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 text-xs"
        />
      </div>

      {/* 6. Selection Summary Banner & Launch Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
        <div className="text-xs">
          <span className="font-semibold text-white">
            {selectedLectures.length} Lectures Selected
          </span>
          <span className="text-zinc-400 block text-[11px] mt-0.5">
            {lecturesWithNotesCount} have study notes recorded
          </span>
        </div>

        <Button
          onClick={handleStartRevision}
          disabled={isCreating || selectedLectures.length === 0}
          className="shrink-0"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              {isScheduled ? 'Scheduling...' : 'Initializing...'}
            </>
          ) : isScheduled ? (
            <>
              <Calendar className="w-4 h-4 mr-1.5" />
              Schedule Revision
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-1.5" />
              Start Revision Now
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
