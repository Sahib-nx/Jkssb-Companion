'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  ArrowRight,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import { findKnowledgeGaps, KnowledgeGapsData } from '@/app/dashboard/revision/ai-actions'
import { useToast } from '@/components/ui/toast'

interface KnowledgeGapsViewProps {
  lectureId: string
  lectureTitle: string
  subjectName: string
  notesText: string
}

export function KnowledgeGapsView({
  lectureTitle,
  subjectName,
  notesText,
}: KnowledgeGapsViewProps) {
  const toast = useToast()
  const [recallText, setRecallText] = useState('')
  const [result, setResult] = useState<KnowledgeGapsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleCompare = async () => {
    if (isLoading) return
    if (!recallText.trim() || recallText.trim().length < 10) {
      toast.error('Please write what you remember (at least 1-2 sentences) first.')
      return
    }

    setIsLoading(true)
    try {
      const res = await findKnowledgeGaps(lectureTitle, subjectName, recallText, notesText)
      if (res.success && res.data) {
        setResult(res.data)
      } else {
        toast.error(res.error || 'Failed to analyze knowledge gaps')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error processing knowledge gaps')
    } finally {
      setIsLoading(false)
    }
  }

  if (!notesText || notesText.trim().length < 15) {
    return (
      <div className="p-8 text-center bg-[#11141D] rounded-xl border border-white/10">
        <BookOpen className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-white mb-1">No Notes Available</h4>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          Add notes to this lecture first so the AI can compare your memory against your notes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent border border-rose-500/20 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Mode 6: Find Knowledge Gaps</h4>
            <p className="text-[11px] text-zinc-400">Compare your memory against your notes to spot blind spots</p>
          </div>
        </div>
      </div>

      {/* Input recall area */}
      <div className="p-5 rounded-xl bg-[#11141D] border border-white/10 space-y-3">
        <label className="text-xs font-medium text-zinc-300 block">
          Write everything you can recall about this lecture from memory:
        </label>
        <textarea
          value={recallText}
          onChange={(e) => setRecallText(e.target.value)}
          rows={4}
          disabled={isLoading}
          placeholder="For example: What were the key laws, definitions, timelines, formulas, or steps covered?..."
          className="w-full p-3.5 rounded-lg bg-black/40 border border-white/10 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50 resize-y leading-relaxed"
        />
        <div className="flex justify-end">
          <Button
            onClick={handleCompare}
            disabled={isLoading || !recallText.trim()}
            className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Comparing with notes...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Find My Knowledge Gaps
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-12 text-center bg-[#11141D] rounded-xl border border-white/10 flex flex-col items-center">
          <Loader2 className="w-7 h-7 text-rose-400 animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Cross-referencing your recall against your lecture notes...</p>
        </div>
      )}

      {/* Analysis Output */}
      {result && !isLoading && (
        <div className="p-6 rounded-xl bg-[#11141D] border border-white/10 space-y-5 animate-in fade-in duration-200">
          <div className="border-b border-white/10 pb-3">
            <h5 className="text-sm font-semibold text-white mb-1">Knowledge Gap Analysis</h5>
            <p className="text-xs text-zinc-300 leading-relaxed">{result.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Retained Points */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
              <span className="text-xs font-semibold text-emerald-300 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" />
                Points You Accurately Retained ({result.retainedPoints?.length || 0})
              </span>
              <ul className="space-y-1.5">
                {result.retainedPoints && result.retainedPoints.length > 0 ? (
                  result.retainedPoints.map((pt, i) => (
                    <li key={i} className="text-xs text-zinc-300 flex items-start">
                      <span className="text-emerald-400 mr-2">✓</span>
                      <span>{pt}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-zinc-500 italic">None detected in input.</li>
                )}
              </ul>
            </div>

            {/* Missed Points */}
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-2">
              <span className="text-xs font-semibold text-rose-300 flex items-center">
                <AlertOctagon className="w-4 h-4 mr-1.5 text-rose-400" />
                Crucial Points Omitted ({result.missedPoints?.length || 0})
              </span>
              <ul className="space-y-1.5">
                {result.missedPoints && result.missedPoints.length > 0 ? (
                  result.missedPoints.map((pt, i) => (
                    <li key={i} className="text-xs text-zinc-300 flex items-start">
                      <span className="text-rose-400 mr-2">✗</span>
                      <span>{pt}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-zinc-400 italic">Great job! No major points missed.</li>
                )}
              </ul>
            </div>
          </div>

          {/* Misconceptions */}
          {result.misconceptions && result.misconceptions.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-2">
              <span className="text-xs font-semibold text-amber-300 flex items-center">
                <HelpCircle className="w-4 h-4 mr-1.5 text-amber-400" />
                Misconceptions to Unlearn ({result.misconceptions.length})
              </span>
              <ul className="space-y-1.5">
                {result.misconceptions.map((m, i) => (
                  <li key={i} className="text-xs text-zinc-300 flex items-start">
                    <span className="text-amber-400 mr-2">!</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Action */}
          {result.recommendedAction && (
            <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-center space-x-2 text-xs">
              <span className="text-zinc-400 shrink-0">Next Recommended Step:</span>
              <span className="text-white font-medium">{result.recommendedAction}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
