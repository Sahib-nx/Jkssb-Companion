/**
 * Spaced Repetition Utility
 * 
 * Computes scheduled revision dates based on active recall self-assessment:
 * - 'remembered': 7 days
 * - 'partially': 3 days
 * - 'did_not_remember': 1 day
 */

export type RecallRating = 'remembered' | 'partially' | 'did_not_remember'

export const RECALL_INTERVALS: Record<RecallRating, { days: number; label: string; badgeColor: string }> = {
  remembered: {
    days: 7,
    label: 'Remembered (7 days)',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  partially: {
    days: 3,
    label: 'Partially remembered (3 days)',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  did_not_remember: {
    days: 1,
    label: 'Did not remember (1 day)',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
}

/**
 * Calculates next revision date ISO string (YYYY-MM-DD)
 */
export function calculateNextRevisionDate(rating: RecallRating, fromDate: Date = new Date()): string {
  const days = RECALL_INTERVALS[rating].days
  const nextDate = new Date(fromDate)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate.toISOString().slice(0, 10)
}
