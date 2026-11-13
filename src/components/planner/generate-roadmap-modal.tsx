'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Sparkles,
  Clock,
  Calendar,
  AlertCircle,
  X,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Target,
  Sliders,
  Info,
} from 'lucide-react'
import { generateSyllabusRoadmapAction } from '@/lib/ai/planner/ai-planner-actions'
import { Subject, AiSyllabusRoadmap } from '@/types/database'
import { useToast } from '@/components/ui/toast'

interface GenerateRoadmapModalProps {
  isOpen: boolean
  onClose: () => void
  onRoadmapGenerated: (roadmap: AiSyllabusRoadmap) => void
  subjects: Subject[]
  existingRoadmap?: AiSyllabusRoadmap | null
}

const HOURS_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6]
const DAYS_OF_WEEK = [
  { id: 'Monday', label: 'Mon' },
  { id: 'Tuesday', label: 'Tue' },
  { id: 'Wednesday', label: 'Wed' },
  { id: 'Thursday', label: 'Thu' },
  { id: 'Friday', label: 'Fri' },
  { id: 'Saturday', label: 'Sat' },
  { id: 'Sunday', label: 'Sun' },
]

export function GenerateRoadmapModal({
  isOpen,
  onClose,
  onRoadmapGenerated,
  subjects,
  existingRoadmap,
}: GenerateRoadmapModalProps) {
  const router = useRouter()
  const toast = useToast()

  const [dailyHours, setDailyHours] = useState<number>(
    existingRoadmap?.daily_study_hours || 2.0
  )
  const [targetDate, setTargetDate] = useState<string>(
    existingRoadmap?.target_date || ''
  )
  const [unavailableDays, setUnavailableDays] = useState<string[]>(
    existingRoadmap?.unavailable_days || []
  )

  const [isGenerating, setIsGenerating] = useState(false)
  const [byokError, setByokError] = useState<{ code: string; message: string } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const toggleDay = (day: string) => {
    setUnavailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isGenerating) return

    setIsGenerating(true)
    setByokError(null)

    try {
      const res = await generateSyllabusRoadmapAction({
        dailyStudyHours: dailyHours,
        targetDate: targetDate ? targetDate : null,
        unavailableDays,
      })

      if (res.success && res.roadmap) {
        toast.success('AI Syllabus Roadmap generated and synchronized with your Daily Planner!')
        onRoadmapGenerated(res.roadmap)
        onClose()
      } else {
        if (res.errorCode === 'NO_API_KEY' || res.errorCode === 'AI_DISABLED') {
          setByokError({ code: res.errorCode, message: res.error || 'API configuration required' })
        }
        toast.error(res.error || 'Failed to generate roadmap.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error generating roadmap.')
    } finally {
      setIsGenerating(false)
    }
  }

  const totalSyllabusLectures = subjects.reduce((acc, s) => acc + (s.total_lectures || 0), 0)

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#11141D] border border-purple-500/25 rounded-2xl shadow-2xl p-4 sm:p-6 md:p-8 text-zinc-100 max-h-[90dvh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={isGenerating}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                {existingRoadmap ? 'Rebalance AI Syllabus Roadmap' : 'Generate AI Syllabus Roadmap'}
              </h3>
              <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30">
                AI Powered
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Personalised, realistic study pacing based on your actual workspace progress
            </p>
          </div>
        </div>

        {/* BYOK Error Alert */}
        {byokError && (
          <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
            <div className="flex items-center space-x-2 font-semibold text-white">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {byokError.code === 'NO_API_KEY'
                  ? 'Google Gemini API Key Required'
                  : 'AI Features Disabled'}
              </span>
            </div>
            <p className="text-zinc-300 leading-relaxed">{byokError.message}</p>
            <div className="flex items-center space-x-2 pt-1">
              <Button
                size="sm"
                onClick={() => {
                  onClose()
                  router.push('/dashboard/settings')
                }}
                className="bg-purple-600 hover:bg-purple-500 text-white h-7 text-xs"
              >
                Open Settings to Configure
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleGenerate} className="space-y-5">
          {/* 1. REQUIRED INPUT: Daily Study Hours */}
          <div className="p-4 rounded-xl bg-[#0B0D12] border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-white font-medium text-xs sm:text-sm">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>How many hours can you realistically study every day?</span>
              </div>
              <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/30 font-mono text-xs">
                {dailyHours} {dailyHours === 1 ? 'Hour' : 'Hours'} / day
              </Badge>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Select your sustainable daily capacity. We balance new lectures with practice questions and spaced revision.
            </p>

            {/* Hours Selector Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {HOURS_OPTIONS.map((h) => {
                const isSelected = dailyHours === h
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setDailyHours(h)}
                    disabled={isGenerating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-purple-600 text-white font-semibold shadow-sm'
                        : 'bg-[#161A24] border border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    {h} {h === 1 ? 'hr' : 'hrs'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. OPTIONAL INPUTS: Target Exam Date & Non-Study Days */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Date */}
            <div className="p-4 rounded-xl bg-[#0B0D12] border border-zinc-800 space-y-2">
              <div className="flex items-center space-x-2 text-white font-medium text-xs">
                <Target className="w-3.5 h-3.5 text-blue-400" />
                <span>Target Exam / Completion Date</span>
              </div>
              <p className="text-[11px] text-zinc-500">Optional: We will evaluate feasibility against your pace.</p>
              <Input
                type="date"
                value={targetDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setTargetDate(e.target.value)}
                disabled={isGenerating}
                className="bg-[#11141D] border-zinc-800 text-white text-xs h-9 focus:border-purple-500"
              />
            </div>

            {/* Non-Study Days */}
            <div className="p-4 rounded-xl bg-[#0B0D12] border border-zinc-800 space-y-2">
              <div className="flex items-center space-x-2 text-white font-medium text-xs">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Days You Cannot Study</span>
              </div>
              <p className="text-[11px] text-zinc-500">Optional: e.g. weekly rest or catch-up days.</p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {DAYS_OF_WEEK.map((d) => {
                  const isOff = unavailableDays.includes(d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      disabled={isGenerating}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                        isOff
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-[#161A24] text-zinc-400 border border-zinc-800/80 hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 3. Automatic Syllabus Summary Preview */}
          <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/15 flex items-start space-x-3 text-xs">
            <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="text-zinc-300 space-y-1">
              <span className="font-semibold text-white block">Workspace Auto-Detection</span>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Found <strong>{subjects.length} subjects</strong> with a total of{' '}
                <strong>{totalSyllabusLectures} lectures</strong>. The planning engine will automatically
                exclude your completed lectures, prioritize your difficult revision topics, and
                distribute remaining work into your Daily Planner.
              </p>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isGenerating}
              className="border-zinc-800 text-zinc-400 hover:text-white h-9 text-xs"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              size="sm"
              disabled={isGenerating}
              className="bg-purple-600 hover:bg-purple-500 text-white font-medium h-9 text-xs min-w-[170px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                  Generating Roadmap...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-2" />
                  {existingRoadmap ? 'Rebalance Roadmap' : 'Generate Study Roadmap'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
