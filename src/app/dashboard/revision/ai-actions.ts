'use server'

import { createClient } from '@/lib/supabase/server'
import { aiRateLimiter } from '@/lib/ai/rate-limiter'
import { generateStructuredJson } from '@/lib/ai/gemini'
import {
  BASE_SYSTEM_PROMPT,
  getQuickRevisionPrompt,
  getActiveRecallQuestionPrompt,
  getActiveRecallEvaluationPrompt,
  getFlashcardsPrompt,
  getImportantPointsPrompt,
  getWeakAreasPrompt,
  getKnowledgeGapsPrompt,
} from '@/lib/ai/prompts'
import { getUserAiPreferences } from '@/lib/ai/consent-actions'

async function checkAuthAndRateLimit() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized. Please sign in to use AI features.')
  }

  const prefs = await getUserAiPreferences()
  if (!prefs.ai_enabled) {
    throw new Error('AI features are disabled in Settings. Please enable them to continue.')
  }

  const rateCheck = aiRateLimiter.checkLimit(user.id)
  if (!rateCheck.allowed) {
    throw new Error(
      `Rate limit reached. Please wait ${rateCheck.retryAfterSeconds} seconds before requesting more AI revision content.`
    )
  }

  return user
}

// 1. QUICK REVISION
export interface QuickRevisionData {
  quickRecap: string
  coreConcepts: { title: string; summary: string }[]
  quickTakeaways: string[]
}

export async function fetchQuickRevision(
  lectureTitle: string,
  subjectName: string,
  notes: string
): Promise<{ success: boolean; data?: QuickRevisionData; error?: string }> {
  try {
    await checkAuthAndRateLimit()
    if (!notes || notes.trim().length < 15) {
      return {
        success: false,
        error: 'No notes found for this lecture. Write or paste notes first to generate quick revision.',
      }
    }

    const prompt = getQuickRevisionPrompt(lectureTitle, subjectName, notes)
    const data = await generateStructuredJson<QuickRevisionData>(prompt, BASE_SYSTEM_PROMPT)
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to generate quick revision' }
  }
}

// 2. ACTIVE RECALL QUESTION
export interface ActiveRecallQuestionData {
  question: string
  difficulty: 'easy' | 'medium' | 'hard'
  topic: string
}

export async function fetchActiveRecallQuestion(
  lectureTitle: string,
  subjectName: string,
  notes: string,
  previousQuestions: string[] = []
): Promise<{ success: boolean; data?: ActiveRecallQuestionData; error?: string }> {
  try {
    await checkAuthAndRateLimit()
    if (!notes || notes.trim().length < 15) {
      return {
        success: false,
        error: 'No notes found for this lecture. Add notes first to practice active recall.',
      }
    }

    const prompt = getActiveRecallQuestionPrompt(lectureTitle, subjectName, notes, previousQuestions)
    const data = await generateStructuredJson<ActiveRecallQuestionData>(prompt, BASE_SYSTEM_PROMPT)
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to generate recall question' }
  }
}

// 2. ACTIVE RECALL EVALUATION
export interface ActiveRecallEvaluationData {
  isCorrect: boolean
  accuracyScore: number
  feedback: string
  keyMissedPoints: string[]
  modelAnswer: string
}

export async function evaluateRecallAnswer(
  question: string,
  userAnswer: string,
  notes: string
): Promise<{ success: boolean; data?: ActiveRecallEvaluationData; error?: string }> {
  try {
    await checkAuthAndRateLimit()
    if (!userAnswer || userAnswer.trim().length === 0) {
      return { success: false, error: 'Please enter an answer to evaluate.' }
    }

    const prompt = getActiveRecallEvaluationPrompt(question, userAnswer, notes)
    const data = await generateStructuredJson<ActiveRecallEvaluationData>(prompt, BASE_SYSTEM_PROMPT)
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to evaluate answer' }
  }
}

// 3. FLASHCARDS
export interface FlashcardItem {
  id: string
  front: string
  back: string
  category: 'Definition' | 'Fact' | 'Formula' | 'Concept' | 'Date'
}

export interface FlashcardsResponse {
  flashcards: FlashcardItem[]
}

export async function fetchFlashcards(
  lectureTitle: string,
  subjectName: string,
  notes: string
): Promise<{ success: boolean; data?: FlashcardsResponse; error?: string }> {
  try {
    await checkAuthAndRateLimit()
    if (!notes || notes.trim().length < 15) {
      return {
        success: false,
        error: 'No notes found for this lecture. Add notes first to generate flashcards.',
      }
    }

    const prompt = getFlashcardsPrompt(lectureTitle, subjectName, notes)
    const data = await generateStructuredJson<FlashcardsResponse>(prompt, BASE_SYSTEM_PROMPT)
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to generate flashcards' }
  }
}

// 4. IMPORTANT POINTS
export interface ImportantPointsData {
  definitions: { term: string; explanation: string }[]
  facts: string[]
  dates: { date: string; event: string }[]
  names: { name: string; significance: string }[]
  formulas: { title: string; formula: string }[]
}

export async function fetchImportantPoints(
  lectureTitle: string,
  subjectName: string,
  notes: string
): Promise<{ success: boolean; data?: ImportantPointsData; error?: string }> {
  try {
    await checkAuthAndRateLimit()
    if (!notes || notes.trim().length < 15) {
      return {
        success: false,
        error: 'No notes found for this lecture. Add notes first to extract key points.',
      }
    }

    const prompt = getImportantPointsPrompt(lectureTitle, subjectName, notes)
    const data = await generateStructuredJson<ImportantPointsData>(prompt, BASE_SYSTEM_PROMPT)
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to extract important points' }
  }
}

// 5. EXPLAIN WEAK AREAS
export interface WeakAreaExplanationData {
  conceptTitle: string
  simpleExplanation: string
  analogyOrExample: string
  memoryTip: string
}

export async function explainWeakArea(
  lectureTitle: string,
  subjectName: string,
  userQuery: string,
  notes: string
): Promise<{ success: boolean; data?: WeakAreaExplanationData; error?: string }> {
  try {
    await checkAuthAndRateLimit()
    if (!userQuery || userQuery.trim().length < 3) {
      return { success: false, error: 'Please enter a concept or question to explain.' }
    }
    if (!notes || notes.trim().length < 15) {
      return {
        success: false,
        error: 'No notes found for this lecture. Add notes first to ask for explanations.',
      }
    }

    const prompt = getWeakAreasPrompt(lectureTitle, subjectName, userQuery, notes)
    const data = await generateStructuredJson<WeakAreaExplanationData>(prompt, BASE_SYSTEM_PROMPT)
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to explain weak area' }
  }
}

// 6. KNOWLEDGE GAPS
export interface KnowledgeGapsData {
  summary: string
  retainedPoints: string[]
  missedPoints: string[]
  misconceptions: string[]
  recommendedAction: string
}

export async function findKnowledgeGaps(
  lectureTitle: string,
  subjectName: string,
  userRecallText: string,
  notes: string
): Promise<{ success: boolean; data?: KnowledgeGapsData; error?: string }> {
  try {
    await checkAuthAndRateLimit()
    if (!userRecallText || userRecallText.trim().length < 10) {
      return {
        success: false,
        error: 'Please write down what you remember (at least 1-2 sentences) to find knowledge gaps.',
      }
    }
    if (!notes || notes.trim().length < 15) {
      return {
        success: false,
        error: 'No notes found for this lecture. Add notes first to check knowledge gaps.',
      }
    }

    const prompt = getKnowledgeGapsPrompt(lectureTitle, subjectName, userRecallText, notes)
    const data = await generateStructuredJson<KnowledgeGapsData>(prompt, BASE_SYSTEM_PROMPT)
    return { success: true, data }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to find knowledge gaps' }
  }
}
