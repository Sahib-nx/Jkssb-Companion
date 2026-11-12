'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Lightbulb,
  RotateCcw,
} from 'lucide-react'
import { fetchQuickRevision, QuickRevisionData } from '@/app/dashboard/revision/ai-actions'
import { useToast } from '@/components/ui/toast'

interface QuickRevisionViewProps {
  lectureId: string
  lectureTitle: string
  subjectName: string
  notesText: string
  notesContent: any
  renderOriginalNotes: () => React.ReactNode
}

export function QuickRevisionView({
  lectureId,
  lectureTitle,
  subjectName,
  notesText,
  renderOriginalNotes,
}: QuickRevisionViewProps) {
  const toast = useToast()
  const [data, setData] = useState<QuickRevisionData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)

  // Auto-generate or reset on lecture change
  useEffect(() => {
    setData(null)
    setShowOriginal(false)
    if (notesText && notesText.trim().length >= 15) {
      handleGenerate()
    }
  }, [lectureId])

  const handleGenerate = async () => {
    if (isLoading || !notesText || notesText.trim().length < 15) {
      return
    }

    setIsLoading(true)
    try {
      const res = await fetchQuickRevision(lectureTitle, subjectName, notesText)
      if (res.success && res.data) {
        setData(res.data)
      } else {
        toast.error(res.error || 'Failed to generate quick revision')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error communicating with AI service')
    } finally {
      setIsLoading(false)
    }
  }

  if (!notesText || notesText.trim().length < 15) {
    return (
      <div className="p-8 text-center bg-[#11141D] rounded-xl border border-white/10">
        <BookOpen className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-white mb-1">No Notes Available</h4>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
          This lecture does not have enough notes recorded yet. Add notes to this lecture first to unlock AI Quick Revision.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20 rounded-xl gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Mode 1: Quick Revision</h4>
            <p className="text-[11px] text-zinc-400">High-yield bullet recap grounded in your notes</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={isLoading}
          className="text-xs border-white/10 text-zinc-300 hover:text-white w-full sm:w-auto min-h-[36px]"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          )}
          {data ? 'Regenerate' : 'Generate Recap'}
        </Button>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="py-12 text-center bg-[#11141D] rounded-xl border border-white/10 flex flex-col items-center">
          <Loader2 className="w-7 h-7 text-purple-400 animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Extracting high-yield concepts from your notes...</p>
        </div>
      )}

      {/* Revision Content */}
      {data && !isLoading && (
        <div className="space-y-4">
          {/* Executive Recap */}
          <div className="p-5 rounded-xl bg-[#11141D] border border-white/10 space-y-2">
            <div className="flex items-center space-x-2 text-xs font-semibold text-purple-300">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span>Executive Summary</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
              {data.quickRecap}
            </p>
          </div>

          {/* Core Concepts */}
          {data.coreConcepts && data.coreConcepts.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Core Concepts
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.coreConcepts.map((concept, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-[#11141D] border border-white/10 hover:border-purple-500/30 transition-colors"
                  >
                    <h6 className="text-xs font-bold text-white mb-1 flex items-center">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] flex items-center justify-center mr-2 shrink-0">
                        {idx + 1}
                      </span>
                      {concept.title}
                    </h6>
                    <p className="text-xs text-zinc-400 leading-relaxed ml-7">
                      {concept.summary}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Takeaways */}
          {data.quickTakeaways && data.quickTakeaways.length > 0 && (
            <div className="p-5 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-purple-300">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span>Exam Takeaways</span>
              </div>
              <ul className="space-y-1.5 pt-1">
                {data.quickTakeaways.map((item, idx) => (
                  <li key={idx} className="flex items-start text-xs text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-2 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Accordion: View Original Notes */}
      <div className="rounded-xl border border-white/10 bg-[#11141D] overflow-hidden">
        <button
          onClick={() => setShowOriginal(!showOriginal)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.02] transition-colors"
        >
          <span className="flex items-center">
            <BookOpen className="w-3.5 h-3.5 mr-2 text-zinc-400" />
            Original Lecture Notes Reference
          </span>
          {showOriginal ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </button>
        {showOriginal && (
          <div className="p-5 border-t border-white/10 bg-black/30">
            {renderOriginalNotes()}
          </div>
        )}
      </div>
    </div>
  )
}
