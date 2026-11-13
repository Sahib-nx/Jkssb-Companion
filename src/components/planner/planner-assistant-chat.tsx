'use client'

import { useState, useEffect, useRef } from 'react'
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
} from 'lucide-react'
import {
  PlannerProposal,
  PlannerAssistantMessage,
  AiSyllabusRoadmap,
} from '@/types/database'
import {
  sendPlannerAssistantMessageAction,
  getPlannerChatHistoryAction,
  applyPlannerProposalAction,
  cancelPlannerProposalAction,
  clearPlannerChatHistoryAction,
} from '@/lib/ai/planner/ai-assistant-actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'

interface PlannerAssistantChatProps {
  todayDate: string
  activeRoadmap?: AiSyllabusRoadmap | null
  todayTasksCount: number
  todayPendingCount: number
  completedLecturesCount: number
  totalLecturesCount: number
  onScheduleUpdated?: () => void
}

const SUGGESTED_PROMPTS = [
  'Adjust my schedule for today.',
  "I missed yesterday's tasks.",
  'Give Mathematics more attention.',
  "Make tomorrow's schedule lighter.",
  'Can I finish my syllabus in six weeks?',
  'Which subject should I prioritise?',
  'I completed additional lectures. Update my plan.',
]

export function PlannerAssistantChat({
  todayDate,
  activeRoadmap,
  todayTasksCount,
  todayPendingCount,
  completedLecturesCount,
  totalLecturesCount,
  onScheduleUpdated,
}: PlannerAssistantChatProps) {
  const toast = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<PlannerAssistantMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null)
  const [byokError, setByokError] = useState<{ code: string; message: string } | null>(null)

  const syllabusProgressPct =
    totalLecturesCount > 0 ? Math.round((completedLecturesCount / totalLecturesCount) * 100) : 0

  // 1. Load chat history on mount
  useEffect(() => {
    let mounted = true
    const loadHistory = async () => {
      try {
        const res = await getPlannerChatHistoryAction()
        if (mounted && res.success && res.messages) {
          setMessages(res.messages)
        }
      } catch (err) {
        console.warn('Failed to load chat history:', err)
      } finally {
        if (mounted) setIsHistoryLoading(false)
      }
    }
    loadHistory()
    return () => {
      mounted = false
    }
  }, [])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 2. Handle Send Message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim()
    if (!text || isLoading) return

    setInputText('')
    setByokError(null)

    // Optimistically append user message to UI
    const tempUserMsg: PlannerAssistantMessage = {
      id: `temp_user_${Date.now()}`,
      user_id: '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])
    setIsLoading(true)

    try {
      const res = await sendPlannerAssistantMessageAction({ message: text })

      if (res.success && res.assistantMessage) {
        const assistantMsg: PlannerAssistantMessage = {
          id: `ast_${Date.now()}`,
          user_id: '',
          role: 'assistant',
          content: res.assistantMessage,
          proposal: res.proposal || null,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } else {
        if (res.errorCode === 'NO_API_KEY' || res.errorCode === 'AI_DISABLED') {
          setByokError({ code: res.errorCode, message: res.error || 'Configuration required' })
        }
        toast.error(res.error || 'Failed to get a response from AI Study Assistant')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error communicating with assistant')
    } finally {
      setIsLoading(false)
    }
  }

  // 3. Handle Apply Proposal
  const handleApplyProposal = async (proposal: PlannerProposal, messageId: string) => {
    if (actionInProgressId) return
    setActionInProgressId(proposal.id)

    try {
      const res = await applyPlannerProposalAction(proposal)
      if (res.success) {
        toast.success(res.message || 'Schedule updated successfully!')

        // Update local message proposal status to 'applied'
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

        // Append assistant confirmation note
        setMessages((prev) => [
          ...prev,
          {
            id: `sys_${Date.now()}`,
            user_id: '',
            role: 'assistant',
            content: `Done! The changes from "${proposal.title}" have been successfully applied to your study planner. Your daily schedule has been updated.`,
            created_at: new Date().toISOString(),
          },
        ])

        if (onScheduleUpdated) {
          onScheduleUpdated()
        }
      } else {
        toast.error(res.error || 'Failed to apply proposal.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error applying proposal.')
    } finally {
      setActionInProgressId(null)
    }
  }

  // 4. Handle Cancel Proposal
  const handleCancelProposal = async (proposalId: string, messageId: string) => {
    if (actionInProgressId) return
    setActionInProgressId(proposalId)

    try {
      const res = await cancelPlannerProposalAction(proposalId)
      if (res.success) {
        toast.info('Proposal cancelled. No changes were made.')

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

  // 5. Handle Clear Chat History
  const handleClearChat = async () => {
    if (!confirm('Are you sure you want to clear your AI Study Assistant conversation history?')) {
      return
    }

    try {
      const res = await clearPlannerChatHistoryAction()
      if (res.success) {
        setMessages([])
        toast.success('Conversation history cleared.')
      } else {
        toast.error(res.error || 'Failed to clear history.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error clearing history.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Context Information Pill / Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-[#11141D] border border-white/10 rounded-xl p-3 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-400 truncate">Today's Remaining</p>
            <p className="text-sm font-semibold text-white">
              {todayPendingCount} of {todayTasksCount} tasks
            </p>
          </div>
        </div>

        <div className="bg-[#11141D] border border-white/10 rounded-xl p-3 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-400 truncate">Daily Availability</p>
            <p className="text-sm font-semibold text-white">
              {activeRoadmap ? `${activeRoadmap.daily_study_hours} hrs/day` : 'Not set'}
            </p>
          </div>
        </div>

        <div className="bg-[#11141D] border border-white/10 rounded-xl p-3 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-400 truncate">Syllabus Completion</p>
            <p className="text-sm font-semibold text-white">
              {completedLecturesCount}/{totalLecturesCount} ({syllabusProgressPct}%)
            </p>
          </div>
        </div>

        <div className="bg-[#11141D] border border-white/10 rounded-xl p-3 flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-400 truncate">Estimated Target</p>
            <p className="text-sm font-semibold text-white truncate">
              {activeRoadmap?.overview?.estimated_completion_date || 'Generate Roadmap'}
            </p>
          </div>
        </div>
      </div>

      {/* BYOK Missing / Disabled Warning */}
      {byokError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-amber-300">Google Gemini API Key Required</h4>
            <p className="text-xs text-amber-200/80 mt-1">{byokError.message}</p>
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center space-x-1 text-xs font-semibold text-amber-300 hover:text-amber-200 underline mt-2"
            >
              <span>Go to Settings &gt; AI Study Assistant</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Main Chat Container */}
      <Card className="bg-[#11141D] border border-white/10 flex flex-col h-[75dvh] min-h-[460px] max-h-[700px] sm:h-[600px] overflow-hidden">
        {/* Chat Header */}
        <CardHeader className="py-3 px-4 border-b border-white/10 flex flex-row items-center justify-between space-y-0 shrink-0 bg-white/[0.01]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-white flex items-center space-x-2">
                <span>AI Study Assistant</span>
                <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30">
                  Gemini Flash-Lite
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Natural-language study planning, schedule rescheduling & feasibility checks
              </CardDescription>
            </div>
          </div>

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearChat}
              className="text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 h-8 px-2"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Clear
            </Button>
          )}
        </CardHeader>

        {/* Messages Stream */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {/* Welcome Message when chat is empty */}
          {messages.length === 0 && !isHistoryLoading && (
            <div className="text-center py-8 space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white">How can I help you study today?</h3>
                <p className="text-xs text-zinc-400">
                  I understand your actual syllabus, completion progress, and daily workload. Ask me to adjust your schedule, reschedule missed work, or test target dates.
                </p>
              </div>

              {/* Prompt Suggestions */}
              <div className="pt-2 flex flex-wrap gap-1.5 justify-center">
                {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-zinc-300 hover:text-white hover:bg-white/[0.08] hover:border-purple-500/30 transition-all text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isHistoryLoading && (
            <div className="flex items-center justify-center py-12 text-zinc-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading your study assistant context...
            </div>
          )}

          {/* Render Messages */}
          {messages.map((msg) => {
            const isUser = msg.role === 'user'

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
              >
                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                      : 'bg-[#181B26] border border-white/10 text-zinc-200 rounded-bl-none shadow-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* PROPOSAL PREVIEW CARD */}
                  {!isUser && msg.proposal && (
                    <div className="mt-3.5 pt-3.5 border-t border-white/10 space-y-3">
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

                      <div className="bg-black/30 rounded-lg p-2.5 border border-white/5 space-y-1.5">
                        <p className="text-xs font-medium text-purple-300">{msg.proposal.title}</p>
                        <p className="text-[11px] text-zinc-400">{msg.proposal.summary}</p>
                      </div>

                      {/* Rescheduled Tasks List */}
                      {msg.proposal.tasks_to_reschedule &&
                        msg.proposal.tasks_to_reschedule.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-medium text-zinc-300">
                              Tasks to Reschedule:
                            </p>
                            <div className="space-y-1">
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
                          </div>
                        )}

                      {/* Added Tasks List (if any) */}
                      {msg.proposal.tasks_to_add && msg.proposal.tasks_to_add.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-zinc-300">New Tasks to Add:</p>
                          <div className="space-y-1">
                            {msg.proposal.tasks_to_add.map((t, idx) => (
                              <div
                                key={idx}
                                className="text-[11px] bg-emerald-500/5 border border-emerald-500/20 rounded-md p-2 flex items-center justify-between"
                              >
                                <span className="text-emerald-300 font-medium truncate">
                                  + {t.taskTitle}
                                </span>
                                <span className="text-zinc-400 text-[10px] shrink-0">
                                  {t.scheduledDate} ({t.estimatedMinutes}m)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Impact Summary */}
                      {msg.proposal.impact_summary && (
                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2.5 text-[11px] text-purple-200/90">
                          <span className="font-semibold text-purple-300">Impact: </span>
                          {msg.proposal.impact_summary}
                        </div>
                      )}

                      {/* Action Buttons for Pending Proposals */}
                      {msg.proposal.status === 'pending' && (
                        <div className="pt-2 flex items-center space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleApplyProposal(msg.proposal!, msg.id)}
                            disabled={actionInProgressId === msg.proposal.id}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 px-3 font-medium flex-1 sm:flex-initial"
                          >
                            {actionInProgressId === msg.proposal.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Apply Changes
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelProposal(msg.proposal!.id, msg.id)}
                            disabled={actionInProgressId === msg.proposal.id}
                            className="border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-xs h-8 px-3 flex-1 sm:flex-initial"
                          >
                            <X className="w-3.5 h-3.5 mr-1.5" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center space-x-2 text-zinc-400 text-xs py-2">
              <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                <Sparkles className="w-3 h-3 animate-pulse" />
              </div>
              <div className="flex items-center space-x-1">
                <span>Analyzing your syllabus and drafting response</span>
                <span className="animate-bounce">.</span>
                <span className="animate-bounce delay-100">.</span>
                <span className="animate-bounce delay-200">.</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Chat Input Bar */}
        <div className="p-3 border-t border-white/10 bg-[#0E1017] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask AI Study Assistant... (e.g. 'I missed yesterday's tasks' or 'Make tomorrow lighter')"
              disabled={isLoading}
              className="flex-1 bg-[#181B26] border border-white/10 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-4 min-h-[40px] shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
