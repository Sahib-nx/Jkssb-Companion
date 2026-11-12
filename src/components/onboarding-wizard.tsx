'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createWorkspace, InitialSubjectInput } from '@/app/dashboard/workspace/actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  Sparkles,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  BookOpen,
  Layers,
  GraduationCap,
  Loader2,
  HelpCircle,
  Wand2,
} from 'lucide-react'

const COLOR_OPTIONS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
]

const QUICK_PRESETS = [
  {
    label: 'JKSSB MTS (4 Subjects • 255 Lectures)',
    subjects: [
      { name: 'General Knowledge', lectureCount: 151, color: '#3B82F6' },
      { name: 'English', lectureCount: 54, color: '#10B981' },
      { name: 'Mathematics', lectureCount: 29, color: '#8B5CF6' },
      { name: 'Reasoning', lectureCount: 21, color: '#F59E0B' },
    ],
  },
  {
    label: 'Standard Competitive Exam (4 Subjects • 200 Lectures)',
    subjects: [
      { name: 'General Awareness', lectureCount: 80, color: '#3B82F6' },
      { name: 'Quantitative Aptitude', lectureCount: 50, color: '#8B5CF6' },
      { name: 'English Language', lectureCount: 40, color: '#10B981' },
      { name: 'Logical Reasoning', lectureCount: 30, color: '#F59E0B' },
    ],
  },
]

export function OnboardingWizard() {
  const router = useRouter()
  const toast = useToast()
  const [step, setStep] = useState<1 | 2>(1)
  const [isPending, startTransition] = useTransition()

  // Initial state with 4 customizable blank/default subjects
  const [subjects, setSubjects] = useState<InitialSubjectInput[]>([
    { name: 'General Knowledge', lectureCount: 100, color: '#3B82F6' },
    { name: 'English', lectureCount: 45, color: '#10B981' },
    { name: 'Mathematics', lectureCount: 60, color: '#8B5CF6' },
    { name: 'Reasoning', lectureCount: 35, color: '#F59E0B' },
  ])

  const totalLectures = subjects.reduce(
    (acc, s) => acc + (Math.max(1, Math.floor(Number(s.lectureCount) || 1))),
    0
  )

  const handleAddSubject = () => {
    const nextColor = COLOR_OPTIONS[subjects.length % COLOR_OPTIONS.length]
    setSubjects([
      ...subjects,
      { name: '', lectureCount: 30, color: nextColor },
    ])
  }

  const handleRemoveSubject = (index: number) => {
    if (subjects.length <= 1) {
      toast.error('You must have at least one subject in your workspace.')
      return
    }
    const updated = subjects.filter((_, i) => i !== index)
    setSubjects(updated)
  }

  const handleSubjectChange = (
    index: number,
    field: 'name' | 'lectureCount' | 'color',
    value: string | number
  ) => {
    const updated = [...subjects]
    if (field === 'lectureCount') {
      const num = Math.max(1, Math.min(500, Math.floor(Number(value) || 1)))
      updated[index] = { ...updated[index], lectureCount: num }
    } else if (field === 'name') {
      updated[index] = { ...updated[index], name: String(value) }
    } else if (field === 'color') {
      updated[index] = { ...updated[index], color: String(value) }
    }
    setSubjects(updated)
  }

  const applyPreset = (preset: typeof QUICK_PRESETS[0]) => {
    setSubjects([...preset.subjects])
    toast.info(`Loaded "${preset.label}" template. You can now edit it freely.`)
  }

  const validateAndProceedToReview = () => {
    const emptyNames = subjects.filter((s) => !s.name.trim())
    if (emptyNames.length > 0) {
      toast.error('Please provide a name for all subjects.')
      return
    }

    const uniqueNames = new Set(subjects.map((s) => s.name.trim().toLowerCase()))
    if (uniqueNames.size !== subjects.length) {
      toast.error('Subject names must be distinct.')
      return
    }

    if (totalLectures < 1) {
      toast.error('Total lectures must be at least 1.')
      return
    }

    setStep(2)
  }

  const handleFinalSubmit = () => {
    startTransition(async () => {
      try {
        const res = await createWorkspace(subjects)
        if (!res.success) {
          toast.error(res.error || 'Failed to initialize study workspace.')
          return
        }

        toast.success('Workspace created successfully! Welcome aboard.')
        router.push('/dashboard')
        router.refresh()
      } catch (err: any) {
        toast.error(err?.message || 'An unexpected error occurred.')
      }
    })
  }

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center relative z-10">
      <div className="w-full max-w-3xl space-y-8">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-medium backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Personal Study Architecture</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-lg">
            Welcome to MTS Companion
          </h1>
          <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto drop-shadow leading-relaxed">
            Let&apos;s set up your personal study workspace. Add your subjects and the number of
            lectures you need to complete in each one.
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4">
          <div
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              step === 1
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'bg-zinc-900/50 border-white/10 text-zinc-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
              1
            </span>
            <span>Configure Subjects</span>
          </div>

          <div className="w-8 h-[1px] bg-white/20" />

          <div
            className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              step === 2
                ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                : 'bg-zinc-900/50 border-white/10 text-zinc-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-blue-600/40 text-white flex items-center justify-center text-[10px]">
              2
            </span>
            <span>Review & Launch</span>
          </div>
        </div>

        {/* STEP 1: CONFIGURE SUBJECTS */}
        {step === 1 && (
          <Card className="border-white/10 bg-[#0B0D12]/75 backdrop-blur-xl shadow-2xl">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-blue-400" />
                    <span>Your Study Syllabus</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-400 mt-0.5">
                    Define the subjects and lecture targets for your examination
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs font-semibold text-blue-300">
                    {subjects.length} {subjects.length === 1 ? 'Subject' : 'Subjects'}
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-300">
                    {totalLectures} Lectures Total
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="pt-3">
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-2">
                  <Wand2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Quick Template Presets:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="px-2.5 py-1 text-[11px] rounded-md border border-white/10 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Subject Rows */}
              <div className="space-y-3">
                {subjects.map((sub, index) => (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl border border-white/10 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-3"
                  >
                    {/* Index & Color Selector */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-6 h-6 rounded-md bg-white/10 text-zinc-300 text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div className="flex gap-1">
                        {COLOR_OPTIONS.slice(0, 4).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => handleSubjectChange(index, 'color', c)}
                            style={{ backgroundColor: c }}
                            className={`w-3.5 h-3.5 rounded-full transition-transform ${
                              sub.color === c ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Subject Name Input */}
                    <div className="flex-1 w-full space-y-1">
                      <label className="text-[11px] font-medium text-zinc-400">Subject Name</label>
                      <Input
                        value={sub.name}
                        onChange={(e) => handleSubjectChange(index, 'name', e.target.value)}
                        placeholder="e.g. General Knowledge, Mathematics..."
                        className="h-9 text-xs bg-zinc-950/70 border-white/10 text-white placeholder:text-zinc-600 focus:border-blue-500"
                      />
                    </div>

                    {/* Lecture Count Input */}
                    <div className="w-full sm:w-36 space-y-1">
                      <label className="text-[11px] font-medium text-zinc-400">Total Lectures</label>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        value={sub.lectureCount}
                        onChange={(e) => handleSubjectChange(index, 'lectureCount', e.target.value)}
                        className="h-9 text-xs bg-zinc-950/70 border-white/10 text-white focus:border-blue-500 text-center"
                      />
                    </div>

                    {/* Delete Subject Button */}
                    <div className="self-end sm:self-center sm:pt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSubject(index)}
                        disabled={subjects.length <= 1}
                        className="h-9 w-9 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                        title="Remove Subject"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Subject Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handleAddSubject}
                className="w-full border-dashed border-white/20 bg-zinc-900/30 hover:bg-zinc-800/60 text-blue-400 hover:text-blue-300 text-xs py-2 h-auto"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                <span>Add Another Subject</span>
              </Button>

              {/* Bottom Actions */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
                  <span>You can always add more subjects and lectures later in Settings.</span>
                </div>

                <Button
                  type="button"
                  onClick={validateAndProceedToReview}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 shadow-lg shadow-blue-600/30"
                >
                  <span>Review Workspace</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: REVIEW WORKSPACE */}
        {step === 2 && (
          <Card className="border-white/10 bg-[#0B0D12]/75 backdrop-blur-xl shadow-2xl">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-400" />
                <span>Confirm Your Workspace Architecture</span>
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Review your study setup before generating your personalized lecture directory.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/40">
                  <div className="text-xs text-zinc-400 font-medium">Total Subjects</div>
                  <div className="text-3xl font-extrabold text-white mt-1">{subjects.length}</div>
                  <div className="text-[11px] text-zinc-400 mt-1">Configured for your syllabus</div>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-zinc-900/40">
                  <div className="text-xs text-zinc-400 font-medium">Total Lectures</div>
                  <div className="text-3xl font-extrabold text-emerald-400 mt-1">{totalLectures}</div>
                  <div className="text-[11px] text-zinc-400 mt-1">Ready for tracking & notes</div>
                </div>
              </div>

              {/* Subject Breakdown List */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Subject-Wise Lecture Breakdown
                </h4>
                <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-zinc-900/30 overflow-hidden">
                  {subjects.map((sub, i) => {
                    const pct = Math.round((sub.lectureCount / totalLectures) * 100) || 0
                    return (
                      <div key={i} className="p-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: sub.color || '#3B82F6' }}
                          />
                          <div className="truncate">
                            <span className="text-sm font-semibold text-white block truncate">
                              {sub.name}
                            </span>
                            <span className="text-[11px] text-zinc-400">
                              Lectures 001 to {String(sub.lectureCount).padStart(3, '0')}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-bold text-white">
                            {sub.lectureCount} lectures
                          </span>
                          <span className="text-xs text-zinc-500 block">({pct}% of total)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isPending}
                  className="w-full sm:w-auto border-white/10 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 text-xs"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  <span>Back to Edit Subjects</span>
                </Button>

                <Button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isPending}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-6 shadow-lg shadow-emerald-600/30 min-h-[40px]"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      <span>Creating Workspace & Lectures...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      <span>Launch My Study Workspace</span>
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
