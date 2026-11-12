'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  KeyRound,
  Loader2,
  RotateCcw,
  BookOpen,
  Calendar,
  User,
  Calculator,
  Check,
  Copy,
} from 'lucide-react'
import { fetchImportantPoints, ImportantPointsData } from '@/app/dashboard/revision/ai-actions'
import { useToast } from '@/components/ui/toast'

interface ImportantPointsViewProps {
  lectureId: string
  lectureTitle: string
  subjectName: string
  notesText: string
}

export function ImportantPointsView({
  lectureId,
  lectureTitle,
  subjectName,
  notesText,
}: ImportantPointsViewProps) {
  const toast = useToast()
  const [data, setData] = useState<ImportantPointsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    if (notesText && notesText.trim().length >= 15) {
      handleGenerate()
    }
  }, [lectureId])

  const handleGenerate = async () => {
    if (isLoading || !notesText || notesText.trim().length < 15) return

    setIsLoading(true)
    try {
      const res = await fetchImportantPoints(lectureTitle, subjectName, notesText)
      if (res.success && res.data) {
        setData(res.data)
      } else {
        toast.error(res.error || 'Failed to extract important points')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error extracting points')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(id)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  if (!notesText || notesText.trim().length < 15) {
    return (
      <div className="p-8 text-center bg-[#11141D] rounded-xl border border-white/10">
        <BookOpen className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-white mb-1">No Notes Available</h4>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          Add notes to this lecture first to extract categorized important points.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Mode 4: Important Points</h4>
            <p className="text-[11px] text-zinc-400">Definitions, dates, formulas, and high-yield facts</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={isLoading}
          className="text-xs border-white/10 text-zinc-300 hover:text-white"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          )}
          {data ? 'Regenerate' : 'Extract Points'}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="py-16 text-center bg-[#11141D] rounded-xl border border-white/10 flex flex-col items-center">
          <Loader2 className="w-7 h-7 text-amber-400 animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Classifying definitions, dates, and facts from notes...</p>
        </div>
      )}

      {/* Content */}
      {data && !isLoading && (
        <div className="space-y-6">
          {/* Section 1: Definitions */}
          {data.definitions && data.definitions.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center">
                <BookOpen className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                Key Definitions ({data.definitions.length})
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.definitions.map((def, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-[#11141D] border border-white/10 hover:border-cyan-500/30 transition-colors relative group"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-xs font-bold text-cyan-300">{def.term}</span>
                      <button
                        onClick={() => handleCopy(`${def.term}: ${def.explanation}`, `def-${i}`)}
                        className="text-zinc-500 hover:text-white p-1"
                        title="Copy"
                      >
                        {copiedIndex === `def-${i}` ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{def.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Dates & Chronology */}
          {data.dates && data.dates.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                Crucial Dates & Events ({data.dates.length})
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.dates.map((d, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-[#11141D] border border-white/10 flex items-start space-x-3"
                  >
                    <Badge variant="outline" className="text-xs font-bold text-rose-400 border-rose-500/30 bg-rose-500/10 shrink-0">
                      {d.date}
                    </Badge>
                    <p className="text-xs text-zinc-300 leading-relaxed flex-1">{d.event}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: High-Yield Facts */}
          {data.facts && data.facts.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center">
                <KeyRound className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                High-Yield Facts ({data.facts.length})
              </h5>
              <div className="p-4 rounded-xl bg-[#11141D] border border-white/10 space-y-2">
                {data.facts.map((fact, i) => (
                  <div key={i} className="flex items-start text-xs text-zinc-300 py-1 border-b border-white/5 last:border-0">
                    <span className="text-amber-400 mr-2 font-bold">•</span>
                    <span className="flex-1 leading-relaxed">{fact}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Names & Significance */}
          {data.names && data.names.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center">
                <User className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                Key Names & Significance ({data.names.length})
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.names.map((n, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-[#11141D] border border-white/10">
                    <span className="text-xs font-bold text-purple-300 block mb-0.5">{n.name}</span>
                    <p className="text-xs text-zinc-400 leading-relaxed">{n.significance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Formulas / Rules */}
          {data.formulas && data.formulas.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center">
                <Calculator className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                Formulas & Rules ({data.formulas.length})
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.formulas.map((f, i) => (
                  <div key={i} className="p-4 rounded-xl bg-[#11141D] border border-emerald-500/20">
                    <span className="text-xs font-bold text-emerald-300 block mb-1">{f.title}</span>
                    <div className="p-2 rounded bg-black/40 font-mono text-xs text-emerald-400">
                      {f.formula}
                    </div>
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
