'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Layers,
  Loader2,
  RotateCw,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BookOpen,
} from 'lucide-react'
import { fetchFlashcards, FlashcardItem } from '@/app/dashboard/revision/ai-actions'
import { useToast } from '@/components/ui/toast'

interface FlashcardsViewProps {
  lectureId: string
  lectureTitle: string
  subjectName: string
  notesText: string
}

export function FlashcardsView({
  lectureId,
  lectureTitle,
  subjectName,
  notesText,
}: FlashcardsViewProps) {
  const toast = useToast()
  const [cards, setCards] = useState<FlashcardItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Card status tracking: cardId -> 'remembered' | 'needs_revision'
  const [statusMap, setStatusMap] = useState<Record<string, 'remembered' | 'needs_revision'>>({})

  useEffect(() => {
    setCards([])
    setCurrentIndex(0)
    setIsFlipped(false)
    setStatusMap({})
    if (notesText && notesText.trim().length >= 15) {
      handleGenerate()
    }
  }, [lectureId])

  const handleGenerate = async () => {
    if (!notesText || notesText.trim().length < 15) return

    setIsLoading(true)
    setIsFlipped(false)
    setCurrentIndex(0)
    try {
      const res = await fetchFlashcards(lectureTitle, subjectName, notesText)
      if (res.success && res.data?.flashcards) {
        setCards(res.data.flashcards)
      } else {
        toast.error(res.error || 'Failed to generate flashcards')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error generating flashcards')
    } finally {
      setIsLoading(false)
    }
  }

  const handleShuffle = () => {
    if (cards.length <= 1) return
    const shuffled = [...cards].sort(() => Math.random() - 0.5)
    setCards(shuffled)
    setCurrentIndex(0)
    setIsFlipped(false)
    toast.info('Deck shuffled!')
  }

  const handleMarkStatus = (status: 'remembered' | 'needs_revision') => {
    const current = cards[currentIndex]
    if (!current) return
    setStatusMap((prev) => ({ ...prev, [current.id]: status }))
    // Automatically advance to next card if available
    if (currentIndex < cards.length - 1) {
      setTimeout(() => {
        setIsFlipped(false)
        setCurrentIndex((i) => i + 1)
      }, 300)
    }
  }

  if (!notesText || notesText.trim().length < 15) {
    return (
      <div className="p-8 text-center bg-[#11141D] rounded-xl border border-white/10">
        <BookOpen className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-white mb-1">No Notes Available</h4>
        <p className="text-xs text-zinc-400 max-w-sm mx-auto">
          Add notes to this lecture first to generate interactive flashcards.
        </p>
      </div>
    )
  }

  const currentCard = cards[currentIndex]
  const rememberedCount = Object.values(statusMap).filter((s) => s === 'remembered').length
  const needsRevisionCount = Object.values(statusMap).filter((s) => s === 'needs_revision').length

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-xl gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Mode 3: Flashcards</h4>
            <p className="text-[11px] text-zinc-400">Flip cards to test atomic concepts</p>
          </div>
        </div>

        {cards.length > 0 && (
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShuffle}
              disabled={isLoading}
              className="text-xs border-white/10 text-zinc-300 hover:text-white"
            >
              <Shuffle className="w-3.5 h-3.5 mr-1.5" />
              Shuffle
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={isLoading}
              className="text-xs border-white/10 text-zinc-300 hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Regenerate
            </Button>
          </div>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="py-16 text-center bg-[#11141D] rounded-xl border border-white/10 flex flex-col items-center">
          <Loader2 className="w-7 h-7 text-emerald-400 animate-spin mb-3" />
          <p className="text-xs text-zinc-400">Synthesizing flashcards from your notes...</p>
        </div>
      )}

      {/* Flashcard Component */}
      {currentCard && !isLoading && (
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Deck Stats Bar */}
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>
              Card <strong className="text-white">{currentIndex + 1}</strong> of{' '}
              <strong className="text-white">{cards.length}</strong>
            </span>
            <div className="flex items-center space-x-3">
              <span className="flex items-center text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {rememberedCount}
              </span>
              <span className="flex items-center text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> {needsRevisionCount}
              </span>
            </div>
          </div>

          {/* Flip Card Canvas */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="cursor-pointer min-h-[260px] p-8 rounded-2xl bg-[#11141D] border border-white/10 hover:border-emerald-500/40 transition-all flex flex-col justify-between shadow-xl relative overflow-hidden group select-none"
          >
            {/* Top Bar: Category and Flip Prompt */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] uppercase font-semibold text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                {currentCard.category || 'Concept'}
              </Badge>
              <span className="text-[11px] text-zinc-500 group-hover:text-zinc-400 flex items-center transition-colors">
                <RotateCw className="w-3 h-3 mr-1" />
                {isFlipped ? 'Click to show front' : 'Click to flip'}
              </span>
            </div>

            {/* Main Center Content */}
            <div className="my-auto py-6 text-center">
              {!isFlipped ? (
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold block mb-2">
                    Front / Prompt
                  </span>
                  <p className="text-base sm:text-lg font-semibold text-white leading-relaxed">
                    {currentCard.front}
                  </p>
                </div>
              ) : (
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold block mb-2">
                    Answer / Explanation
                  </span>
                  <p className="text-sm sm:text-base text-zinc-200 leading-relaxed font-mono">
                    {currentCard.back}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Status Tag */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
              <span className="text-zinc-500">
                Status:{' '}
                {statusMap[currentCard.id] === 'remembered' ? (
                  <strong className="text-emerald-400">Remembered</strong>
                ) : statusMap[currentCard.id] === 'needs_revision' ? (
                  <strong className="text-amber-400">Needs Revision</strong>
                ) : (
                  <span className="text-zinc-500">Unrated</span>
                )}
              </span>
              <span className="text-zinc-500">Click anywhere to flip</span>
            </div>
          </div>

          {/* Rating & Navigation Controls */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsFlipped(false)
                setCurrentIndex((i) => Math.max(0, i - 1))
              }}
              disabled={currentIndex === 0}
              className="text-xs border-white/10 text-zinc-300 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Prev
            </Button>

            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleMarkStatus('needs_revision')}
                className={`text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10 ${
                  statusMap[currentCard.id] === 'needs_revision' ? 'bg-amber-500/20' : ''
                }`}
              >
                Needs Revision
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleMarkStatus('remembered')}
                className={`text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 ${
                  statusMap[currentCard.id] === 'remembered' ? 'bg-emerald-500/20' : ''
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Remembered
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsFlipped(false)
                setCurrentIndex((i) => Math.min(cards.length - 1, i + 1))
              }}
              disabled={currentIndex === cards.length - 1}
              className="text-xs border-white/10 text-zinc-300 hover:text-white"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
