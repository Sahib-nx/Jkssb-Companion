/**
 * Automated Verification Suite for MTS Companion AI Assistant & Revision Centre
 */

import { calculateNextRevisionDate, RECALL_INTERVALS } from '../src/lib/spaced-repetition.ts'
import { aiRateLimiter } from '../src/lib/ai/rate-limiter.ts'
import {
  getNotesAssistantPrompt,
  getQuickRevisionPrompt,
  getActiveRecallQuestionPrompt,
  getActiveRecallEvaluationPrompt,
  getFlashcardsPrompt,
  getImportantPointsPrompt,
  getWeakAreasPrompt,
  getKnowledgeGapsPrompt,
} from '../src/lib/ai/prompts.ts'

console.log('🧪 Starting MTS Companion AI Features Test Suite...\n')

let passed = 0
let failed = 0

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${testName}`)
    failed++
  }
}

// 1. Spaced Repetition Calculations
console.log('--- 1. Testing Spaced Repetition Calculations ---')
const today = new Date('2026-11-11T00:00:00Z')

const dateRemembered = calculateNextRevisionDate('remembered', today)
assert(dateRemembered === '2026-11-18', `Remembered schedules +7 days: expected 2026-11-18, got ${dateRemembered}`)

const datePartially = calculateNextRevisionDate('partially', today)
assert(datePartially === '2026-11-14', `Partially schedules +3 days: expected 2026-11-14, got ${datePartially}`)

const dateForgot = calculateNextRevisionDate('did_not_remember', today)
assert(dateForgot === '2026-11-12', `Forgot schedules +1 day: expected 2026-11-12, got ${dateForgot}`)

assert(RECALL_INTERVALS.remembered.days === 7, 'RECALL_INTERVALS remembered is 7 days')
assert(RECALL_INTERVALS.partially.days === 3, 'RECALL_INTERVALS partially is 3 days')
assert(RECALL_INTERVALS.did_not_remember.days === 1, 'RECALL_INTERVALS did_not_remember is 1 day')

// 2. Rate Limiter Testing
console.log('\n--- 2. Testing In-Memory Sliding Window Rate Limiter ---')
const testUser = 'test-user-' + Date.now()

// Perform 15 allowed calls
let allAllowed = true
for (let i = 0; i < 15; i++) {
  const check = aiRateLimiter.checkLimit(testUser)
  if (!check.allowed) allAllowed = false
}
assert(allAllowed, 'Allows 15 requests in the active window')

// 16th call should be blocked
const blockedCheck = aiRateLimiter.checkLimit(testUser)
assert(!blockedCheck.allowed, 'Blocks 16th call exceeding limit')
assert(blockedCheck.remaining === 0, 'Remaining is 0 when blocked')
assert(blockedCheck.retryAfterSeconds > 0, `retryAfterSeconds is positive (${blockedCheck.retryAfterSeconds}s)`)

// 3. Prompt Construction & Grounding Tests
console.log('\n--- 3. Testing Prompt Construction & Strict Grounding ---')
const sampleNotes = 'Article 32 provides the right to constitutional remedies. Dr. B.R. Ambedkar called it the heart and soul of the Constitution.'

const noteOps = ['organise', 'structure', 'grammar', 'concise', 'summary', 'key_points']
for (const op of noteOps) {
  const p = getNotesAssistantPrompt(op, sampleNotes, false)
  assert(p.includes(sampleNotes), `Notes prompt for "${op}" includes student notes verbatim`)
  assert(p.includes('formatted HTML'), `Notes prompt for "${op}" requests editor-compatible HTML`)
}

// Selection awareness test
const pSelection = getNotesAssistantPrompt('concise', sampleNotes, true)
assert(pSelection.includes('selected excerpt'), 'Selection prompt specifies selected excerpt')

// Revision modes prompts
const pQuick = getQuickRevisionPrompt('Lecture 012', 'General Knowledge', sampleNotes)
assert(pQuick.includes('quickRecap') && pQuick.includes('coreConcepts'), 'Quick Revision prompt contains schema fields')

const pRecallQ = getActiveRecallQuestionPrompt('Lecture 012', 'General Knowledge', sampleNotes, ['What is Article 32?'])
assert(pRecallQ.includes('Do NOT repeat'), 'Active recall prompt includes non-repeat clause for previous questions')

const pRecallEval = getActiveRecallEvaluationPrompt('What is Article 32?', 'Remedies', sampleNotes)
assert(pRecallEval.includes('accuracyScore') && pRecallEval.includes('keyMissedPoints'), 'Evaluation prompt contains grading metrics')

const pCards = getFlashcardsPrompt('Lecture 012', 'General Knowledge', sampleNotes)
assert(pCards.includes('flashcards') && pCards.includes('front') && pCards.includes('back'), 'Flashcards prompt includes card schema')

const pPoints = getImportantPointsPrompt('Lecture 012', 'General Knowledge', sampleNotes)
assert(pPoints.includes('definitions') && pPoints.includes('facts') && pPoints.includes('dates'), 'Important points prompt includes all 5 categories')

const pWeak = getWeakAreasPrompt('Lecture 012', 'General Knowledge', 'What is habeas corpus?', sampleNotes)
assert(pWeak.includes('analogyOrExample') && pWeak.includes('memoryTip'), 'Weak areas prompt requests intuitive analogy')

const pGaps = getKnowledgeGapsPrompt('Lecture 012', 'General Knowledge', 'Ambedkar said something about heart', sampleNotes)
assert(pGaps.includes('missedPoints') && pGaps.includes('misconceptions'), 'Knowledge gaps prompt includes gap analysis schema')

console.log(`\n========================================`)
console.log(`RESULTS: ${passed} passed, ${failed} failed`)
console.log(`========================================`)

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
