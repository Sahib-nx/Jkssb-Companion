'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BrainCircuit,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Send,
  Calendar,
  Sparkles,
  ArrowRight,
  BookOpen,
} from 'lucide-react'
import {
  fetchActiveRecallQuestion,
  evaluateRecallAnswer,
  ActiveRecallQuestionData,
  ActiveRecallEvaluationData,
} from '@/app/dashboard/revision/ai-actions'
import { RecallRating, RECALL_INTERVALS } from '@/lib/spaced-repetition'
import { useToast } from '@/components/ui/toast'

interface ActiveRecallViewProps {
  lectureId: string
  lectureTitle: string
  subjectName: string
  notesText: string
  onRecordRecallRating: (rating: RecallRating) => Promise<void>
}

export function ActiveRecallView({
  lectureId,
  lectureTitle,
  subjectName,
  notesText,
  onRecordRecallRating,
}: ActiveRecallViewProps) {
  const toast = useToast()
  const [questionData, setQuestionData] = useState<ActiveRecallQuestionData | null>(null)
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([])
  const [userAnswer, setUserAnswer] = useState('')
  const [evaluation, setEvaluation] = useState<ActiveRecallEvaluationData | null>(null)
  const [isFetchingQuestion, setIsFetchingQuestion] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [recordedRating, setRecordedRating] = useState<RecallRating | null>(null)

  // Reset when lectureId changes
  useEffect(() => {
    setQuestionData(null)
    setPreviousQuestions([])
    setUserAnswer('')
    setEvaluation(null)
    setRecordedRating(null)
    if (notesText && notesText.trim().length >= 15) {
      handleGetNextQuestion([])
    }
  }, [lectureId])

  const handleGetNextQuestion = async (history: string[] = previousQuestions) => {
    if (!notesText || notesText.trim().length < 15) return

    setIsFetchingQuestion(true)
    setUserAnswer('')
    setEvaluation(null)
    setRecordedRating(null)

    try {
      const res = await fetchActiveRecallQuestion(
        lectureTitle,
        subjectName,
        notesText,
        history
      )
      if (res.success && res.data) {
        setQuestionData(res.data)
        setPreviousQuestions((prev) => [...prev, res.data!.question])
      } else {
        toast.error(res.error || 'Failed to generate recall question')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error generating question')
    } finally {
      setIsFetchingQuestion(false)
    }
  }

  const handleSubmitAnswer = async () => {
    if (!questionData || !userAnswer.trim()) {
      toast.error('Please type your answer before submitting.')
      return
    }

    setIsEvaluating(true)
    try {
      const res = await evaluateRecallAnswer(
        questionData.question,
        userAnswer,
        notesText
      )
      if (res.success && res.data) {
        setEvaluation(res.data)
      } else {
        toast.error(res.error || 'Failed to evaluate answer')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error evaluating answer')
    } finally {
      setIsEvaluating(false)
    }
  }

  const handleRatingClick = async (rating: RecallRating) => {
    try {
      setRecordedRating(rating)
      await onRecordRecallRating(rating)
      toast.success(
        `Rating recorded! Next revision scheduled in ${RECALL_INTERVALS[rating].days} days.`
      )
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save revision rating')
    }
  }

  if (!notesText || notesText.trim().length < 15) {
    return (
      <div className="p-8 text-center bg-[#11141D] rounded-xl border border-white/10">
        <BookOpen className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-white mb-1">No Notes Available</h4>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          Add notes to this lecture first to practice Active Recall testing.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 rounded-xl">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Mode 2: Active Recall</h4>
            <p className="text-[11px] text-zinc-400">Test yourself one question at a time</p>
          </div>
        </div>
        <div className="text-xs text-zinc-400">
          Question {previousQuestions.length > 0 ? previousQuestions.length : 1}
        </div>
      </div>

      {/* Loading Question */}
      {isFetchingQuestion && (
        <div className="py-12 text-center bg-[#11141D] rounded-xl border border-white/10 flex flex-col items-center">
          <Loader2 className="w-7 h-7 text-blue-400 animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Formulating active recall question from your notes...</p>
        </div>
      )}

      {/* Active Question Box */}
      {questionData && !isFetchingQuestion && (
        <div className="p-6 rounded-xl bg-[#11141D] border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-[10px] uppercase font-semibold text-blue-400 border-blue-500/30 bg-blue-500/10">
                {questionData.topic || 'Concept Test'}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase text-zinc-400 border-white/10">
                {questionData.difficulty}
              </Badge>
            </div>
          </div>

          <h3 className="text-base font-semibold text-white leading-relaxed">
            {questionData.question}
          </h3>

          {/* User Answer Input Area */}
          <div className="space-y-2 pt-2">
            <label className="text-xs text-zinc-400 block">
              Type your answer from memory (no looking at notes!):
            </label>
            <textarea
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={isEvaluating || !!evaluation}
              placeholder="Explain the concept, facts, dates or definitions here..."
              rows={3}
              className="w-full p-3 rounded-lg bg-black/40 border border-white/10 text-base sm:text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500/50 resize-y"
            />
          </div>

          {/* Evaluation Trigger */}
          {!evaluation && (
            <div className="flex justify-end">
              <Button
                onClick={handleSubmitAnswer}
                disabled={isEvaluating || !userAnswer.trim()}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium w-full sm:w-auto min-h-[40px]"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Grading against notes...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Submit for AI Evaluation
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Evaluation Results Card */}
          {evaluation && (
            <div className="p-5 rounded-xl bg-white/[0.02] border border-white/10 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  {evaluation.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-amber-400" />
                  )}
                  <span className="text-sm font-semibold text-white">
                    {evaluation.isCorrect ? 'Well Remembered!' : 'Needs Reinforcement'}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs font-bold ${
                    evaluation.accuracyScore >= 75
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : evaluation.accuracyScore >= 50
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                >
                  {evaluation.accuracyScore}% Accuracy
                </Badge>
              </div>

              {/* Feedback text */}
              <p className="text-xs text-zinc-300 leading-relaxed">
                {evaluation.feedback}
              </p>

              {/* Missed Points */}
              {evaluation.keyMissedPoints && evaluation.keyMissedPoints.length > 0 && (
                <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-500/20 space-y-1.5">
                  <span className="text-[11px] font-semibold text-rose-300 block">
                    Points Omitted from Notes:
                  </span>
                  <ul className="space-y-1">
                    {evaluation.keyMissedPoints.map((pt, i) => (
                      <li key={i} className="text-xs text-zinc-300 flex items-start">
                        <span className="text-rose-400 mr-2">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Model Answer */}
              {evaluation.modelAnswer && (
                <div className="p-3.5 rounded-lg bg-blue-950/20 border border-blue-500/20 space-y-1.5">
                  <span className="text-[11px] font-semibold text-blue-300 block">
                    Model Answer (from your notes):
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                    {evaluation.modelAnswer}
                  </p>
                </div>
              )}

              {/* Spaced Repetition Self-Assessment */}
              <div className="pt-3 border-t border-white/10 space-y-2">
                <span className="text-xs text-zinc-400 block font-medium">
                  Self-Assessment (Schedules Next Spaced Revision):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRatingClick('remembered')}
                    className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center transition-all min-h-[40px] ${
                      recordedRating === 'remembered'
                        ? 'bg-emerald-600 text-white border-emerald-500 font-semibold'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    Remembered (7d)
                  </button>

                  <button
                    onClick={() => handleRatingClick('partially')}
                    className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center transition-all min-h-[40px] ${
                      recordedRating === 'partially'
                        ? 'bg-amber-600 text-white border-amber-500 font-semibold'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-300 hover:bg-amber-500/20'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    Partially (3d)
                  </button>

                  <button
                    onClick={() => handleRatingClick('did_not_remember')}
                    className={`p-2.5 rounded-lg border text-xs font-medium flex items-center justify-center transition-all min-h-[40px] ${
                      recordedRating === 'did_not_remember'
                        ? 'bg-rose-600 text-white border-rose-500 font-semibold'
                        : 'bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/20'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    Forgot (1d)
                  </button>
                </div>
              </div>

              {/* Next Question Button */}
              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGetNextQuestion()}
                  className="text-xs border-white/10 text-zinc-300 hover:text-white w-full sm:w-auto min-h-[38px]"
                >
                  <span>Next Question</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
