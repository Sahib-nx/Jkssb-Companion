'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  X,
  Calendar,
  Clock,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  BookOpen,
  ExternalLink,
  Sliders,
  Zap,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  HelpCircle,
  TrendingUp,
  Target,
  Layers,
} from 'lucide-react'
import {
  OverviewAssistantMessage,
  PlannerProposal,
} from '@/types/database'
import {
  sendOverviewAssistantMessageAction,
  getOverviewChatHistoryAction,
  clearOverviewChatHistoryAction,
} from '@/lib/ai/overview/overview-actions'
import {
  applyPlannerProposalAction,
  cancelPlannerProposalAction,
} from '@/lib/ai/planner/ai-assistant-actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'

interface OverviewAssistantSectionProps {
  hasConfiguredWorkspace: boolean
  totalLectures: number
  completedLectures: number
  remainingLectures: number
  overallPercentage: number
  subjectsCount: number
}

const PRIMARY_SUGGESTED_PROMPTS = [
  'What should I study today?',
  'Analyse my overall progress.',
  'Which subject needs more attention?',
  'How much of my syllabus is remaining?',
  'Can I complete my syllabus within my target date?',
  'Summarise my pending revisions.',
]

/**
 * Lightweight, safe parser for assistant markdown responses.
 * Formats bolding, bullet lists, numbered lists, and internal Study Companion markdown links.
 */
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n')

  return (
    <div className="space-y-2 text-xs sm:text-sm leading-relaxed text-zinc-200">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) {
          return <div key={idx} className="h-1" />
        }

        // Headings
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="text-xs sm:text-sm font-bold text-white pt-1">
              {renderInlineMarkdown(trimmed.slice(4))}
            </h4>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="text-sm sm:text-base font-bold text-white pt-1.5">
              {renderInlineMarkdown(trimmed.slice(3))}
            </h3>
          )
        }

        // Bullet lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-2">
              <span className="text-purple-400 mt-1 shrink-0">&bull;</span>
              <span>{renderInlineMarkdown(trimmed.slice(2))}</span>
            </div>
          )
        }

        // Numbered lists
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-2">
              <span className="text-blue-400 font-semibold shrink-0">
                {numberedMatch[1]}.
              </span>
              <span>{renderInlineMarkdown(numberedMatch[2])}</span>
            </div>
          )
        }

        // Normal paragraph
        return <p key={idx}>{renderInlineMarkdown(trimmed)}</p>
      })}
    </div>
  )
}

/**
 * Parses bold (**text**) and markdown links ([text](url)) into clickable React elements.
 */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  // Regex to split on [link text](url) or **bold text**
  const tokenRegex = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g
  const parts = text.split(tokenRegex)

  return parts.map((part, i) => {
    // Markdown links: [Label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      const label = linkMatch[1]
      const url = linkMatch[2]
      return (
        <Link
          key={i}
          href={url}
          className="inline-flex items-center text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 mx-0.5 transition-colors"
        >
          <span>{label}</span>
          <ExternalLink className="w-3 h-3 ml-0.5 inline opacity-70" />
        </Link>
      )
    }

    // Bold text: **text**
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/)
    if (boldMatch) {
      return (
        <strong key={i} className="font-semibold text-white">
          {boldMatch[1]}
        </strong>
      )
    }

    return part
  })
}

export function OverviewAssistantSection({
  hasConfiguredWorkspace,
  totalLectures,
  completedLectures,
  remainingLectures,
  overallPercentage,
  subjectsCount,
}: OverviewAssistantSectionProps) {
  const toast = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<OverviewAssistantMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null)
  const [byokError, setByokError] = useState<{ code: string; message: string } | null>(null)

  // 1. Fetch chat history on component mount
  useEffect(() => {
    let mounted = true
    const loadHistory = async () => {
      try {
        const res = await getOverviewChatHistoryAction()
        if (mounted && res.success && res.messages) {
          setMessages(res.messages)
        }
      } catch (err) {
        console.warn('Failed to load overview chat history:', err)
      } finally {
        if (mounted) setIsHistoryLoading(false)
      }
    }
    loadHistory()
    return () => {
      mounted = false
    }
  }, [])

  // 2. Scroll to bottom of message list on updates
  useEffect(() => {
    if (isExpanded && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isExpanded, isLoading])

  // 3. Handle sending message
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText
    if (!textToSend.trim() || isLoading) return

    // Auto-expand conversation area when user interacts
    setIsExpanded(true)
    setByokError(null)

    const userMessage: OverviewAssistantMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      created_at: new Date().toISOString(),
    }

    // Optimistically append user message
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInputText('')
    setIsLoading(true)

    try {
      const clientHistory = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await sendOverviewAssistantMessageAction({
        message: textToSend.trim(),
        clientHistory,
      })

      if (res.success && res.assistantMessage) {
        const aiMessage: OverviewAssistantMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: res.assistantMessage,
          proposal: res.proposal || null,
          suggestedFollowUps: res.suggestedFollowUps,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, aiMessage])
      } else {
        if (res.errorCode === 'NO_API_KEY' || res.errorCode === 'AI_DISABLED') {
          setByokError({
            code: res.errorCode,
            message: res.error || 'Gemini API key is required to use Ask Study Companion.',
          })
        }
        toast.error(res.error || 'Could not reach Ask Study Companion.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate response.')
    } finally {
      setIsLoading(false)
    }
  }

  // 4. Handle applying a proposed schedule change
  const handleApplyProposal = async (proposal: PlannerProposal, messageId: string) => {
    if (actionInProgressId) return
    setActionInProgressId(proposal.id)

    try {
      const res = await applyPlannerProposalAction(proposal)
      if (res.success) {
        toast.success(res.message || 'Schedule changes applied successfully!')

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId || (m.proposal && m.proposal.id === proposal.id)
              ? {
                  ...m,
                  proposal: m.proposal ? { ...m.proposal, status: 'applied' } : null,
                }
              : m
          )
        )
      } else {
        toast.error(res.error || 'Failed to apply proposed schedule.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error executing schedule changes.')
    } finally {
      setActionInProgressId(null)
    }
  }

  // 5. Handle cancelling a proposed schedule change
  const handleCancelProposal = async (proposalId: string, messageId: string) => {
    if (actionInProgressId) return
    setActionInProgressId(proposalId)

    try {
      const res = await cancelPlannerProposalAction(proposalId)
      if (res.success) {
        toast.info('Proposal cancelled. No schedule changes were made.')

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId || (m.proposal && m.proposal.id === proposalId)
              ? {
                  ...m,
                  proposal: m.proposal ? { ...m.proposal, status: 'cancelled' } : null,
                }
              : m
          )
        )
      } else {
        toast.error(res.error || 'Failed to cancel proposal.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error cancelling proposal.')
    } finally {
      setActionInProgressId(null)
    }
  }

  // 6. Handle clearing conversation history
  const handleClearHistory = async () => {
    if (!confirm('Start a fresh conversation with Ask Study Companion?')) return

    try {
      const res = await clearOverviewChatHistoryAction()
      if (res.success) {
        setMessages([])
        toast.success('Conversation history cleared.')
      } else {
        toast.error(res.error || 'Failed to clear chat history.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error clearing history.')
    }
  }

  return (
    <Card className="border border-purple-500/25 bg-[#0B0D12]/75 backdrop-blur-md shadow-2xl overflow-hidden transition-all duration-200">
      {/* Header Bar */}
      <CardHeader className="py-3.5 px-4 sm:px-6 border-b border-white/10 bg-gradient-to-r from-purple-950/20 via-blue-950/15 to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <CardTitle className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Ask Study Companion
                </CardTitle>
                <Badge
                  variant="outline"
                  className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30 font-medium"
                >
                  Central Intelligence
                </Badge>
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                Your personal study assistant. Understand your progress, identify what needs attention, and plan your next move.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="h-8 px-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                title="Start a fresh conversation"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                <span>Clear</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2.5 text-xs text-purple-300 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:text-white"
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
                  <span>Open Full View</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Unconfigured Workspace Warning */}
        {!hasConfiguredWorkspace && (
          <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl p-4 flex items-start space-x-3">
            <Layers className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-white">Your study workspace is not configured yet</h4>
              <p className="text-xs text-zinc-300 mt-1">
                Configure your course subjects and lectures to unlock personalized progress analysis and study recommendations.
              </p>
              <Link href="/dashboard/settings" className="inline-block mt-2">
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white">
                  <span>Go to Workspace Settings</span>
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Missing Gemini BYOK API Key Warning Banner */}
        {byokError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-300">Google Gemini API Key Required</h4>
              <p className="text-xs text-amber-200/90 mt-1">{byokError.message}</p>
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center space-x-1 text-xs font-semibold text-amber-300 hover:text-amber-200 underline mt-2"
              >
                <span>Go to Settings &gt; AI Study Assistant & Privacy</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Suggested Question Chips (Always discoverable on Overview) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center">
              <HelpCircle className="w-3 h-3 mr-1 text-purple-400" />
              Suggested Study Queries
            </span>
            <span className="text-[11px] text-zinc-500 hidden sm:inline">
              Click any question to ask instantly
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRIMARY_SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-zinc-300 hover:text-white hover:bg-purple-500/15 hover:border-purple-500/30 transition-all text-left min-h-[32px] disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Expanded Messages Conversation Stream */}
        {isExpanded && (
          <div className="border border-white/10 bg-[#0E1017] rounded-xl flex flex-col h-[65dvh] min-h-[380px] max-h-[580px] overflow-hidden animate-in fade-in duration-200">
            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {messages.length === 0 && !isHistoryLoading && (
                <div className="text-center py-8 space-y-3 max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">How can I assist your study plan today?</h4>
                  <p className="text-xs text-zinc-400">
                    I understand your {totalLectures} lectures across {subjectsCount} subjects, your {completedLectures} completed lectures ({overallPercentage}%), your scheduled revisions, and today&apos;s daily planner workload.
                  </p>
                </div>
              )}

              {isHistoryLoading && (
                <div className="flex items-center justify-center py-10 text-zinc-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin mr-2 text-purple-400" />
                  Loading your study conversation...
                </div>
              )}

              {messages.map((msg) => {
                const isUser = msg.role === 'user'

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                          : 'bg-[#161922] border border-white/10 text-zinc-200 rounded-bl-none shadow-md'
                      }`}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )}

                      {/* Interactive Proposal Preview Card (Capability 5) */}
                      {!isUser && msg.proposal && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5">
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-xs font-semibold text-white">
                                Proposed Schedule Modification
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                msg.proposal.status === 'applied'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : msg.proposal.status === 'cancelled'
                                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                              }`}
                            >
                              {msg.proposal.status === 'applied'
                                ? 'Changes Applied'
                                : msg.proposal.status === 'cancelled'
                                ? 'Cancelled'
                                : 'Pending Confirmation'}
                            </Badge>
                          </div>

                          <div className="bg-black/30 rounded-lg p-2.5 border border-white/5 space-y-1">
                            <p className="text-xs font-semibold text-purple-300">{msg.proposal.title}</p>
                            <p className="text-[11px] text-zinc-400">{msg.proposal.summary}</p>
                          </div>

                          {/* Rescheduled Tasks List */}
                          {msg.proposal.tasks_to_reschedule && msg.proposal.tasks_to_reschedule.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                                Tasks to Reschedule:
                              </p>
                              {msg.proposal.tasks_to_reschedule.map((t, idx) => (
                                <div
                                  key={idx}
                                  className="text-[11px] bg-white/[0.02] border border-white/5 rounded-md p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                                >
                                  <span className="text-zinc-200 font-medium truncate">
                                    {t.taskTitle}
                                  </span>
                                  <div className="flex items-center space-x-1 text-zinc-400 shrink-0">
                                    <span className="line-through text-red-400/80">
                                      {t.currentScheduledDate}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-purple-400" />
                                    <span className="text-emerald-400 font-medium">
                                      {t.newScheduledDate}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Impact Summary */}
                          {msg.proposal.impact_summary && (
                            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2 text-[11px] text-purple-200/90">
                              <span className="font-semibold text-purple-300">Impact: </span>
                              {msg.proposal.impact_summary}
                            </div>
                          )}

                          {/* Action Buttons for Pending Proposals */}
                          {msg.proposal.status === 'pending' && (
                            <div className="pt-1.5 flex items-center space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleApplyProposal(msg.proposal!, msg.id)}
                                disabled={actionInProgressId === msg.proposal.id}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 font-semibold flex-1 sm:flex-initial min-h-[36px]"
                              >
                                {actionInProgressId === msg.proposal.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                <span>Apply Changes</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelProposal(msg.proposal!.id, msg.id)}
                                disabled={actionInProgressId === msg.proposal.id}
                                className="border-white/10 hover:bg-white/5 text-zinc-300 text-xs h-8 px-3 font-medium min-h-[36px]"
                              >
                                <span>Cancel</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Suggested Follow-Ups */}
                      {!isUser && msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-white/5 flex flex-wrap gap-1.5">
                          {msg.suggestedFollowUps.map((fu, fIdx) => (
                            <button
                              key={fIdx}
                              type="button"
                              onClick={() => handleSendMessage(fu)}
                              disabled={isLoading}
                              className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-purple-300 hover:text-white hover:bg-purple-500/20 transition-all text-left"
                            >
                              &rarr; {fu}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {isLoading && (
                <div className="flex items-center space-x-2 text-zinc-400 text-xs py-2 pl-1">
                  <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                    <Sparkles className="w-3 h-3 animate-pulse" />
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>Ask Study Companion is analyzing your progress</span>
                    <span className="animate-bounce">.</span>
                    <span className="animate-bounce delay-100">.</span>
                    <span className="animate-bounce delay-200">.</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* Input Form Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="flex items-center space-x-2 pt-1"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask anything about your syllabus, revisions, or what to study next..."
            disabled={isLoading}
            className="flex-1 bg-[#12151F] border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50 min-h-[42px]"
          />
          <Button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 min-h-[42px] shrink-0 font-semibold shadow-md shadow-purple-600/20"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="flex items-center space-x-1.5">
                <span className="hidden sm:inline">Ask</span>
                <Send className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
