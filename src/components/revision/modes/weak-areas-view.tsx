'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  HelpCircle,
  Loader2,
  Send,
  Sparkles,
  Lightbulb,
  Compass,
  BookmarkCheck,
  BookOpen,
} from 'lucide-react'
import { explainWeakArea, WeakAreaExplanationData } from '@/app/dashboard/revision/ai-actions'
import { useToast } from '@/components/ui/toast'

interface WeakAreasViewProps {
  lectureId: string
  lectureTitle: string
  subjectName: string
  notesText: string
}

export function WeakAreasView({
  lectureTitle,
  subjectName,
  notesText,
}: WeakAreasViewProps) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<WeakAreaExplanationData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleAsk = async () => {
    if (isLoading) return
    if (!query.trim() || query.trim().length < 3) {
      toast.error('Please enter a question or topic to explain.')
      return
    }

    setIsLoading(true)
    try {
      const res = await explainWeakArea(lectureTitle, subjectName, query, notesText)
      if (res.success && res.data) {
        setResult(res.data)
      } else {
        toast.error(res.error || 'Failed to explain weak area')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error processing request')
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
          Add notes to this lecture first so the AI can explain concepts grounded in your study material.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Mode 5: Explain My Weak Areas</h4>
            <p className="text-[11px] text-zinc-400">Simplified analogies and memory hooks grounded in your notes</p>
          </div>
        </div>
      </div>

      {/* Input Box */}
      <div className="p-5 rounded-xl bg-[#11141D] border border-white/10 space-y-3">
        <label className="text-xs font-medium text-zinc-300 block">
          What concept or topic in this lecture feels confusing or difficult?
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="e.g. How does the Vice President's casting vote work? or Rule of LCM..."
            disabled={isLoading}
            className="flex-1 px-3.5 py-2.5 rounded-lg bg-black/40 border border-white/10 text-base sm:text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 min-h-[40px]"
          />
          <Button
            onClick={handleAsk}
            disabled={isLoading || !query.trim()}
            className="text-xs bg-violet-600 hover:bg-violet-500 text-white font-medium shrink-0 w-full sm:w-auto min-h-[40px]"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            Explain Simply
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 text-center bg-[#11141D] rounded-xl border border-white/10 flex flex-col items-center">
          <Loader2 className="w-7 h-7 text-violet-400 animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Building an intuitive analogy from your lecture notes...</p>
        </div>
      )}

      {/* Result Explanation */}
      {result && !isLoading && (
        <div className="p-6 rounded-xl bg-[#11141D] border border-white/10 space-y-4 animate-in fade-in duration-200">
          <div className="border-b border-white/10 pb-3 flex items-center justify-between">
            <h5 className="text-sm font-semibold text-white flex items-center">
              <Compass className="w-4 h-4 mr-2 text-violet-400" />
              {result.conceptTitle}
            </h5>
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
              Simplified Tutor Breakdown
            </span>
          </div>

          {/* Simple Explanation */}
          <div className="space-y-1">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              In Plain English:
            </span>
            <p className="text-xs text-zinc-200 leading-relaxed">
              {result.simpleExplanation}
            </p>
          </div>

          {/* Analogy */}
          {result.analogyOrExample && (
            <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/20 space-y-1.5">
              <span className="text-xs font-semibold text-violet-300 flex items-center">
                <Lightbulb className="w-4 h-4 mr-1.5 text-amber-400" />
                Intuitive Analogy / Real-World Example:
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed italic">
                "{result.analogyOrExample}"
              </p>
            </div>
          )}

          {/* Memory Hook */}
          {result.memoryTip && (
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
              <span className="text-xs font-semibold text-emerald-300 flex items-center">
                <BookmarkCheck className="w-4 h-4 mr-1.5 text-emerald-400" />
                Exam Retention Hook:
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {result.memoryTip}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
