'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  Scale,
  CalendarCheck,
  RotateCcw,
  Clock,
  ArrowRight,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  BarChart3,
  Flame,
  CheckCircle2,
  Trash2,
} from 'lucide-react'
import {
  AnalyticsAssistantMessage,
  AnalyticsInsightItem,
  PlannerProposal,
} from '@/types/database'
import {
  sendAnalyticsAssistantMessageAction,
  getAnalyticsChatHistoryAction,
  clearAnalyticsChatHistoryAction,
  getDeterministicAnalyticsInsightsAction,
} from '@/lib/ai/analytics/analytics-actions'
import {
  applyPlannerProposalAction,
  cancelPlannerProposalAction,
} from '@/lib/ai/planner/ai-assistant-actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'

interface AnalyticsAssistantSectionProps {
  overallStats: {
    total_lectures: number
    completed_count: number
    in_progress_count: number
    remaining_count: number
    progress_percentage: number
  }
  subjectComparison: {
    name: string
    total: number
    completed: number
    inProgress: number
    percentage: number
  }[]
  totalRevisionEvents: number
  totalTasks: number
  completedTasks: number
}

const PRIMARY_SUGGESTED_QUERIES = [
  'Analyse my overall performance.',
  'Which subject needs the most attention?',
  'Compare my subjects.',
  'Am I becoming more consistent?',
  'How much of my syllabus remains?',
  'Can I finish my syllabus before my target date?',
  'Summarise my study activity this month.',
  'How can I improve my revision consistency?',
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
              <span className="text-blue-400 mt-1 shrink-0">&bull;</span>
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
          {label}
          <ExternalLink className="w-2.5 h-2.5 ml-0.5 inline opacity-70" />
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

export function AnalyticsAssistantSection({
  overallStats,
  subjectComparison,
  totalRevisionEvents,
  totalTasks,
  completedTasks,
}: AnalyticsAssistantSectionProps) {
  const toast = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [isExpanded, setIsExpanded] = useState(true)
  const [messages, setMessages] = useState<AnalyticsAssistantMessage[]>([])
  const [deterministicInsights, setDeterministicInsights] = useState<AnalyticsInsightItem[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null)
  const [byokError, setByokError] = useState<{ code: string; message: string } | null>(null)

  // 1. Initial Load: Fetch chat history and deterministic diagnostic insights
  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      try {
        const [historyRes, insightsRes] = await Promise.all([
          getAnalyticsChatHistoryAction(),
          getDeterministicAnalyticsInsightsAction(),
        ])

        if (mounted) {
          if (historyRes.success && historyRes.messages) {
            setMessages(historyRes.messages)
          }
          if (insightsRes.success && insightsRes.insights) {
            setDeterministicInsights(insightsRes.insights)
          }
        }
      } catch (err) {
        console.warn('Failed to load analytics assistant initial data:', err)
      } finally {
        if (mounted) setIsHistoryLoading(false)
      }
    }

    loadData()
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

  // 3. Handle sending a query
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputText
    if (!textToSend.trim() || isLoading) return

    setIsExpanded(true)
    setByokError(null)

    const userMessage: AnalyticsAssistantMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      created_at: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInputText('')
    setIsLoading(true)

    try {
      const clientHistory = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await sendAnalyticsAssistantMessageAction({
        message: textToSend.trim(),
        clientHistory,
      })

      if (!res.success) {
        if (res.errorCode === 'NO_API_KEY' || res.errorCode === 'AI_DISABLED') {
          setByokError({
            code: res.errorCode,
            message: res.error || 'Gemini API Key configuration needed.',
          })
        } else {
          toast.error(res.error || 'Failed to get analysis. Please try again.')
        }

        // Keep user message so they don't lose their input
        return
      }

      if (res.assistantMessage) {
        const assistantMessage: AnalyticsAssistantMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: res.assistantMessage,
          insights: res.insights,
          proposal: res.proposal,
          suggestedFollowUps: res.suggestedFollowUps,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMessage])

        // Update top-level insights if newly provided
        if (res.insights && res.insights.length > 0) {
          setDeterministicInsights(res.insights)
        }
      }
    } catch (err: any) {
      console.error('Error contacting AI Analytics Assistant:', err)
      toast.error('Failed to connect to AI Analytics Assistant. Please check your network or API key.')
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  // 4. Handle Applying a Planner Proposal from the Analytics Assistant
  const handleApplyProposal = async (proposal: PlannerProposal) => {
    setActionInProgressId(proposal.id)
    try {
      const res = await applyPlannerProposalAction(proposal)
      if (res.success) {
        toast.success('Proposal applied successfully! Your study schedule has been updated.')
        // Update local status of proposal
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.proposal && msg.proposal.id === proposal.id) {
              return {
                ...msg,
                proposal: { ...msg.proposal, status: 'applied' },
              }
            }
            return msg
          })
        )
      } else {
        toast.error(res.error || 'Failed to apply proposal.')
      }
    } catch (err: any) {
      toast.error('Error applying proposal.')
    } finally {
      setActionInProgressId(null)
    }
  }

  // 5. Clear conversation history
  const handleClearHistory = async () => {
    if (messages.length === 0) return
    const confirmed = window.confirm('Clear your AI Analytics conversation history?')
    if (!confirmed) return

    setMessages([])
    try {
      await clearAnalyticsChatHistoryAction()
      toast.success('Chat history cleared.')
    } catch (err) {
      console.warn('Failed to clear chat history:', err)
    }
  }

  // Compute fallback badge metrics from props in case deterministicInsights is still loading
  const taskCompletionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const sortedSubjects = [...subjectComparison].sort((a, b) => b.percentage - a.percentage)
  const highestSub = sortedSubjects[0]
  const lowestSub = sortedSubjects[sortedSubjects.length - 1]
  const subjectGap = highestSub && lowestSub ? highestSub.percentage - lowestSub.percentage : 0

  return (
    <Card className="border border-blue-500/20 bg-gradient-to-b from-[#111625] to-[#0E1118] shadow-2xl rounded-2xl overflow-hidden transition-all duration-300">
      {/* Header Bar */}
      <CardHeader className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-900/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <CardTitle className="text-base sm:text-lg font-bold text-white tracking-tight">
                  AI Analytics Assistant
                </CardTitle>
                <Badge
                  variant="outline"
                  className="hidden xs:inline-flex text-[10px] py-0 px-2 bg-blue-500/10 border-blue-500/30 text-blue-300"
                >
                  Gemini 3.5 Flash Lite
                </Badge>
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                Understand your progress, discover patterns, and make smarter study decisions.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearHistory}
                className="h-8 px-2 text-xs text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                title="Clear conversation history"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                <span className="hidden sm:inline">Clear</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 px-2.5 text-xs border-zinc-700 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-300"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 mr-1" />
                  <span className="text-xs">Collapse</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 mr-1" />
                  <span className="text-xs">Open Assistant</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Deterministic Diagnostic Badges Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-3 mt-1">
          {deterministicInsights.length > 0 ? (
            deterministicInsights.map((badge) => {
              const badgeBg =
                badge.badgeColor === 'emerald'
                  ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400'
                  : badge.badgeColor === 'rose'
                  ? 'border-rose-500/20 bg-rose-950/20 text-rose-400'
                  : badge.badgeColor === 'amber'
                  ? 'border-amber-500/20 bg-amber-950/20 text-amber-400'
                  : badge.badgeColor === 'purple'
                  ? 'border-purple-500/20 bg-purple-950/20 text-purple-400'
                  : 'border-blue-500/20 bg-blue-950/20 text-blue-400'

              return (
                <div
                  key={badge.id}
                  className={`p-2.5 rounded-xl border ${badgeBg} flex flex-col justify-between`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                      {badge.title}
                    </span>
                    {badge.trend === 'up' && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                    {badge.trend === 'down' && <TrendingDown className="w-3 h-3 text-rose-400" />}
                  </div>
                  <span className="text-sm sm:text-base font-bold text-white mt-1 block truncate">
                    {badge.value}
                  </span>
                  {badge.subtitle && (
                    <span className="text-[10px] text-zinc-400 truncate block mt-0.5" title={badge.subtitle}>
                      {badge.subtitle}
                    </span>
                  )}
                </div>
              )
            })
          ) : (
            // Fallback immediate deterministic cards while server action resolves
            <>
              <div className="p-2.5 rounded-xl border border-blue-500/20 bg-blue-950/20 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Syllabus Finish</span>
                <span className="text-sm sm:text-base font-bold text-white mt-1">
                  {overallStats.progress_percentage}% Done
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">
                  {overallStats.remaining_count} lectures left
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-amber-500/20 bg-amber-950/20 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Subject Balance</span>
                <span className="text-sm sm:text-base font-bold text-white mt-1">
                  {subjectGap > 15 ? `${subjectGap}% Gap` : 'Balanced'}
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5 truncate">
                  {highestSub?.name || 'N/A'} vs {lowestSub?.name || 'N/A'}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-purple-500/20 bg-purple-950/20 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Task Execution</span>
                <span className="text-sm sm:text-base font-bold text-white mt-1">
                  {taskCompletionRate}% Rate
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">
                  {completedTasks}/{totalTasks} tasks
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Revision Volume</span>
                <span className="text-sm sm:text-base font-bold text-white mt-1">
                  {totalRevisionEvents} Events
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">
                  Revision Centre
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-blue-500/20 bg-blue-950/20 flex flex-col justify-between col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Projection</span>
                <span className="text-sm sm:text-base font-bold text-white mt-1">
                  Pacing Analysis
                </span>
                <span className="text-[10px] text-zinc-400 mt-0.5">
                  Ask assistant below
                </span>
              </div>
            </>
          )}
        </div>
      </CardHeader>

      {/* Main Collapsible Assistant Content */}
      {isExpanded && (
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* BYOK Missing Key Banner */}
          {byokError && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <p className="font-semibold text-amber-300">Gemini API Key Required</p>
                <p className="text-zinc-300 mt-0.5">{byokError.message}</p>
                <Link
                  href="/dashboard/settings"
                  className="inline-flex items-center text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 mt-2"
                >
                  Configure your free Gemini key in Settings
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>
          )}

          {/* Chat Messages List */}
          <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3.5 scrollbar-thin scrollbar-thumb-zinc-700">
            {messages.length === 0 && (
              <div className="text-center py-6 px-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-2.5">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-semibold text-white">How can I help you interpret your progress?</h4>
                <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
                  Ask me to evaluate your velocity, compare subjects, detect study habits, or project when you will complete your syllabus.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 shadow-md ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-[#161B26] border border-zinc-800 text-zinc-200 rounded-bl-xs'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 pb-1 border-b border-zinc-800/80">
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[11px] font-semibold text-zinc-400">
                          AI Analytics Diagnostic
                        </span>
                      </div>

                      <MarkdownRenderer content={msg.content} />

                      {/* Interactive Proposal Card */}
                      {msg.proposal && (
                        <div className="mt-3 p-3 rounded-xl border border-blue-500/30 bg-[#0E121B] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white flex items-center">
                              <CalendarCheck className="w-3.5 h-3.5 text-blue-400 mr-1.5" />
                              {msg.proposal.title}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] capitalize ${
                                msg.proposal.status === 'applied'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              }`}
                            >
                              {msg.proposal.status}
                            </Badge>
                          </div>

                          <p className="text-xs text-zinc-300">{msg.proposal.summary}</p>

                          <div className="text-[11px] text-zinc-400 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800">
                            <strong className="text-zinc-200">Impact: </strong>
                            {msg.proposal.impact_summary}
                          </div>

                          {msg.proposal.status === 'pending' && (
                            <div className="pt-1 flex items-center space-x-2">
                              <Button
                                size="sm"
                                disabled={actionInProgressId === msg.proposal.id}
                                onClick={() => handleApplyProposal(msg.proposal!)}
                                className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
                              >
                                {actionInProgressId === msg.proposal.id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                    Applying...
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-3 h-3 mr-1" />
                                    Apply Schedule Changes
                                  </>
                                )}
                              </Button>
                              <Link
                                href="/dashboard/planner"
                                className="text-xs text-zinc-400 hover:text-white underline underline-offset-2 ml-2"
                              >
                                View in Daily Planner
                              </Link>
                            </div>
                          )}

                          {msg.proposal.status === 'applied' && (
                            <div className="flex items-center text-xs text-emerald-400 font-medium pt-1">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              Schedule successfully updated in Daily Planner
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs sm:text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {/* Follow-up chips for assistant messages */}
                {msg.role === 'assistant' && msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ml-1 max-w-[90%]">
                    {msg.suggestedFollowUps.map((chip, chipIdx) => (
                      <button
                        key={chipIdx}
                        type="button"
                        onClick={() => handleSendMessage(chip)}
                        disabled={isLoading}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/60 transition-colors flex items-center space-x-1"
                      >
                        <span>{chip}</span>
                        <ArrowRight className="w-2.5 h-2.5 opacity-60" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center space-x-2 text-xs text-zinc-400 bg-[#161B26] border border-zinc-800 rounded-2xl p-3.5 max-w-[70%]">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Evaluating database progress and calculating trends...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Queries Chips */}
          <div className="pt-2 border-t border-zinc-800/80">
            <span className="text-[11px] text-zinc-400 font-medium block mb-1.5">
              Suggested Questions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRIMARY_SUGGESTED_QUERIES.map((query, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(query)}
                  disabled={isLoading}
                  className="text-xs px-2.5 py-1 rounded-lg bg-zinc-800/60 hover:bg-blue-600/20 hover:border-blue-500/40 text-zinc-300 hover:text-blue-300 border border-zinc-700/50 transition-colors text-left"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>

          {/* User Input Bar */}
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
              placeholder="Ask AI Analytics anything about your performance, velocity, or habits..."
              disabled={isLoading}
              className="flex-1 bg-[#0A0D14] border border-zinc-700/80 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors"
            />
            <Button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl h-10 px-4 shrink-0 font-medium text-xs sm:text-sm shadow-md shadow-blue-500/20"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">Ask</span>
                </>
              )}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  )
}
