'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  ListTree,
  LayoutTemplate,
  CheckCheck,
  Scissors,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  X,
  Check,
  RotateCcw,
  ArrowRight,
  Split,
  Eye,
} from 'lucide-react'
import { NotesOperation } from '@/lib/ai/prompts'
import { processNotesWithAI } from '@/app/dashboard/notes/ai-actions'
import { useToast } from '@/components/ui/toast'

interface NotesAssistantDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedText: string | null
  fullText: string
  onApplyChanges: (htmlContent: string, isSelection: boolean) => void
}

const OPERATIONS: {
  id: NotesOperation
  title: string
  description: string
  icon: any
  color: string
}[] = [
  {
    id: 'organise',
    title: 'Organise My Notes',
    description: 'Structure notes into logical headings, bullet points, and key takeaways.',
    icon: ListTree,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    id: 'structure',
    title: 'Improve Structure',
    description: 'Enhance hierarchy (H1, H2, H3), flow, and visual readability.',
    icon: LayoutTemplate,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    id: 'grammar',
    title: 'Correct Grammar',
    description: 'Fix spelling, grammar, and sentence clarity while preserving facts.',
    icon: CheckCheck,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'concise',
    title: 'Make Concise',
    description: 'Trim redundant fluff by 30-50% while retaining every factual point.',
    icon: Scissors,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'summary',
    title: 'Create a Short Summary',
    description: 'Produce a high-yield executive summary box at the top of your note.',
    icon: FileSpreadsheet,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  {
    id: 'key_points',
    title: 'Extract Key Points',
    description: 'Isolate atomic definitions, formulas, dates, and exam facts.',
    icon: KeyRound,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
]

export function NotesAssistantDialog({
  isOpen,
  onClose,
  selectedText,
  fullText,
  onApplyChanges,
}: NotesAssistantDialogProps) {
  const toast = useToast()
  const [selectedOperation, setSelectedOperation] = useState<NotesOperation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'preview' | 'original'>('preview')

  const hasSelection = !!selectedText && selectedText.trim().length > 0
  const activeText = hasSelection ? selectedText! : fullText

  if (!isOpen) return null

  const handleRunOperation = async (op: NotesOperation) => {
    setSelectedOperation(op)
    setIsLoading(true)

    try {
      const res = await processNotesWithAI(op, activeText, hasSelection)
      if (res.success && res.transformedContent) {
        setPreviewContent(res.transformedContent)
      } else {
        toast.error(res.error || 'Failed to process notes')
        setSelectedOperation(null)
      }
    } catch (err: any) {
      toast.error(err?.message || 'Unexpected error running AI assistant')
      setSelectedOperation(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = () => {
    if (!previewContent) return
    onApplyChanges(previewContent, hasSelection)
    toast.success('Changes applied to note! Press Ctrl+Z to undo anytime.')
    handleReset()
    onClose()
  }

  const handleDiscard = () => {
    handleReset()
    onClose()
  }

  const handleReset = () => {
    setPreviewContent(null)
    setSelectedOperation(null)
    setIsLoading(false)
    setActiveTab('preview')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#11141D] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">AI Notes Assistant</h3>
              <p className="text-xs text-zinc-400">
                {hasSelection ? (
                  <span className="text-purple-300 font-medium">
                    Operating on highlighted selection ({selectedText?.length} chars)
                  </span>
                ) : (
                  <span>Operating on entire note document</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleDiscard}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STATE 1: Operation Selection */}
          {!previewContent && !isLoading && (
            <div>
              <p className="text-xs text-zinc-400 mb-4">
                Select an operation below. You will be able to review the suggested changes in a
                side-by-side preview before applying them.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {OPERATIONS.map((op) => {
                  const Icon = op.icon
                  return (
                    <button
                      key={op.id}
                      onClick={() => handleRunOperation(op.id)}
                      className="flex items-start text-left p-4 rounded-xl border border-white/10 hover:border-purple-500/40 bg-white/[0.02] hover:bg-white/[0.05] transition-all group"
                    >
                      <div className={`p-2.5 rounded-lg border ${op.color} mr-3.5 shrink-0 group-hover:scale-105 transition-transform`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors">
                            {op.title}
                          </h4>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          {op.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STATE 2: Loading State */}
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <div className="relative mb-4">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 animate-pulse">
                  <Sparkles className="w-7 h-7" />
                </div>
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin absolute -top-1 -right-1" />
              </div>
              <h4 className="text-base font-medium text-white mb-1">
                Processing with Gemini AI...
              </h4>
              <p className="text-xs text-zinc-400 max-w-sm">
                Analysing notes and grounding suggestions strictly on your lecture content.
              </p>
            </div>
          )}

          {/* STATE 3: Preview & Approval Diff */}
          {previewContent && !isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl border border-white/5">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-zinc-400">Reviewing suggestions for:</span>
                  <span className="text-purple-300 font-medium capitalize">
                    {OPERATIONS.find((o) => o.id === selectedOperation)?.title}
                  </span>
                </div>
                {/* Mobile Tab Switcher */}
                <div className="flex md:hidden bg-zinc-800/80 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      activeTab === 'preview'
                        ? 'bg-purple-600 text-white font-medium'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Suggested
                  </button>
                  <button
                    onClick={() => setActiveTab('original')}
                    className={`px-3 py-1 rounded-md transition-colors ${
                      activeTab === 'original'
                        ? 'bg-zinc-700 text-white font-medium'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Original
                  </button>
                </div>
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original View */}
                <div className={`flex flex-col rounded-xl border border-white/10 bg-black/40 overflow-hidden ${
                  activeTab === 'original' ? 'block' : 'hidden md:flex'
                }`}>
                  <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/10 text-xs font-medium text-zinc-400 flex items-center justify-between">
                    <span>Original Notes {hasSelection && '(Selected Text)'}</span>
                    <span className="text-[10px] text-zinc-500 uppercase">Read-only</span>
                  </div>
                  <div className="p-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap max-h-[360px] overflow-y-auto leading-relaxed">
                    {activeText}
                  </div>
                </div>

                {/* AI Suggested View */}
                <div className={`flex flex-col rounded-xl border border-purple-500/30 bg-purple-950/10 overflow-hidden ${
                  activeTab === 'preview' ? 'block' : 'hidden md:flex'
                }`}>
                  <div className="px-4 py-2.5 bg-purple-500/10 border-b border-purple-500/20 text-xs font-medium text-purple-300 flex items-center justify-between">
                    <span className="flex items-center">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                      Suggested Changes
                    </span>
                    <span className="text-[10px] text-purple-400/80 uppercase font-semibold">Preview</span>
                  </div>
                  <div
                    className="p-4 text-xs text-zinc-200 max-h-[360px] overflow-y-auto leading-relaxed prose prose-invert prose-xs max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewContent }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between shrink-0">
          {previewContent ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs border-white/10 text-zinc-400 hover:text-white"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Try Another Action
              </Button>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  className="text-xs border-white/10 text-zinc-400 hover:text-white"
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-medium"
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Apply Changes
                </Button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">
                AI modifications never overwrite notes silently.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                className="text-xs border-white/10 text-zinc-400 hover:text-white"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
