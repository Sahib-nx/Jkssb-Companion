'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
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
  ExternalLink,
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
  icon: React.ComponentType<{ className?: string }>
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
  const router = useRouter()
  const toast = useToast()
  const [mounted, setMounted] = useState(false)
  const [selectedOperation, setSelectedOperation] = useState<NotesOperation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'preview' | 'original'>('preview')
  const [byokError, setByokError] = useState<{ code: string; message: string } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock background scroll when dialog is active
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen])

  const hasSelection = !!selectedText && selectedText.trim().length > 0
  const activeText = hasSelection ? selectedText! : fullText

  const handleRunOperation = async (op: NotesOperation) => {
    if (isLoading) return
    setSelectedOperation(op)
    setIsLoading(true)

    try {
      const res = await processNotesWithAI(op, activeText, hasSelection)
      if (res.success && res.transformedContent) {
        setPreviewContent(res.transformedContent)
        setByokError(null)
      } else {
        if (res.errorCode === 'NO_API_KEY' || res.errorCode === 'AI_DISABLED') {
          setByokError({ code: res.errorCode, message: res.error || 'Configuration required' })
        }
        toast.error(res.error || 'Failed to process notes')
        setSelectedOperation(null)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error running AI assistant'
      toast.error(msg)
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

  if (!isOpen || !mounted) return null

  const dialogContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#11141D] border border-white/10 rounded-2xl shadow-2xl flex flex-col h-[90dvh] max-h-[90dvh] sm:h-auto sm:max-h-[88vh] overflow-hidden text-zinc-100 overscroll-contain">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/10 shrink-0 bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-white">AI Notes Assistant</h3>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                {hasSelection ? (
                  <span className="text-purple-300 font-medium">
                    Selection ({selectedText?.length} chars)
                  </span>
                ) : (
                  <span>Entire note document</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={handleDiscard}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6 overscroll-contain">
          {/* STATE 1: Operation Selection */}
          {!previewContent && !isLoading && (
            <div>
              {byokError && (
                <div className="mb-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <KeyRound className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="font-semibold text-white mb-0.5">
                          {byokError.code === 'NO_API_KEY'
                            ? 'Google Gemini API Key Required'
                            : 'AI Assistant Currently Disabled'}
                        </h5>
                        <p className="text-zinc-300 leading-relaxed mb-3">
                          {byokError.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              onClose()
                              router.push('/dashboard/settings')
                            }}
                            className="bg-purple-600 hover:bg-purple-500 text-white h-8 text-xs font-medium"
                          >
                            Open Settings to Configure Key
                          </Button>
                          <a
                            href="https://aistudio.google.com/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-purple-300 hover:text-white text-xs font-medium px-2 py-1"
                          >
                            Get Free Key on Google AI Studio
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </a>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setByokError(null)}
                      className="text-zinc-400 hover:text-white p-1 rounded hover:bg-white/5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
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
                      disabled={isLoading}
                      className="flex items-start text-left p-3.5 sm:p-4 rounded-xl border border-white/10 hover:border-purple-500/40 bg-white/[0.02] hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed transition-all group min-h-[64px]"
                    >
                      <div className={`p-2.5 rounded-lg border ${op.color} mr-3.5 shrink-0 group-hover:scale-105 transition-transform`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors">
                          {op.title}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                          {op.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STATE 2: Loading Analysis */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 animate-pulse">
                  <Sparkles className="w-7 h-7 animate-spin" />
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-white">
                  {OPERATIONS.find((o) => o.id === selectedOperation)?.title}...
                </h4>
                <p className="text-xs text-purple-300">
                  Powered by Google Gemini Flash-Lite
                </p>
              </div>
              <p className="text-xs text-zinc-400 max-w-sm">
                Analysing notes and grounding suggestions strictly on your lecture content.
              </p>
            </div>
          )}

          {/* STATE 3: Preview & Approval Diff */}
          {previewContent && !isLoading && (
            <div className="space-y-4 flex flex-col h-full min-h-0">
              <div className="flex items-center justify-between bg-white/[0.03] p-3 rounded-xl border border-white/5 shrink-0">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 flex-1 min-h-0">
                {/* Original View */}
                <div
                  className={`flex flex-col rounded-xl border border-white/10 bg-black/40 overflow-hidden ${
                    activeTab === 'original' ? 'flex' : 'hidden md:flex'
                  } min-h-[220px] sm:min-h-0`}
                >
                  <div className="px-3.5 py-2.5 bg-white/[0.03] border-b border-white/10 text-xs font-medium text-zinc-400 flex items-center justify-between shrink-0">
                    <span className="truncate">Original Notes {hasSelection && '(Selected Text)'}</span>
                    <span className="text-[10px] text-zinc-500 uppercase shrink-0 ml-2">Read-only</span>
                  </div>
                  <div className="p-3.5 sm:p-4 text-xs text-zinc-300 font-mono whitespace-pre-wrap overflow-y-auto leading-relaxed flex-1 break-words">
                    {activeText}
                  </div>
                </div>

                {/* AI Suggested View */}
                <div
                  className={`flex flex-col rounded-xl border border-purple-500/30 bg-purple-950/10 overflow-hidden ${
                    activeTab === 'preview' ? 'flex' : 'hidden md:flex'
                  } min-h-[220px] sm:min-h-0`}
                >
                  <div className="px-3.5 py-2.5 bg-purple-500/10 border-b border-purple-500/20 text-xs font-medium text-purple-300 flex items-center justify-between shrink-0">
                    <span className="flex items-center truncate">
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-400 shrink-0" />
                      Suggested Changes
                    </span>
                    <span className="text-[10px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded uppercase font-semibold shrink-0 ml-2">
                      Preview
                    </span>
                  </div>
                  <div
                    className="p-3.5 sm:p-4 text-xs sm:text-sm text-zinc-200 overflow-y-auto leading-relaxed prose prose-invert prose-xs sm:prose-sm max-w-none break-words flex-1 selection:bg-purple-600 selection:text-white"
                    dangerouslySetInnerHTML={{ __html: previewContent }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions - Sticky bottom & accessible */}
        <div className="p-3.5 sm:px-6 sm:py-3.5 border-t border-white/10 bg-[#0E1118] shrink-0 z-10 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          {previewContent ? (
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="text-xs border-white/10 text-zinc-400 hover:text-white h-10 sm:h-8 min-h-[40px] sm:min-h-[32px]"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Try Another Action
              </Button>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  className="text-xs border-white/10 text-zinc-400 hover:text-white flex-1 sm:flex-initial h-10 sm:h-8 min-h-[40px] sm:min-h-[32px]"
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handleApply}
                  className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-medium flex-1 sm:flex-initial h-10 sm:h-8 min-h-[40px] sm:min-h-[32px]"
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Apply Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between gap-2">
              <span className="text-[11px] text-zinc-500 truncate mr-2">
                AI modifications never overwrite notes silently.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                className="text-xs border-white/10 text-zinc-400 hover:text-white h-9 sm:h-8 min-h-[36px] sm:min-h-[32px] shrink-0"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(dialogContent, document.body)
}
