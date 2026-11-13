/**
 * System Prompts & Prompt Templates for Study Companion AI Engine
 * 
 * Strict Grounding Requirement:
 * All responses must be grounded strictly in the student's supplied notes.
 * No external hallucinated facts or topics outside the notes.
 */

export const BASE_SYSTEM_PROMPT = `You are the specialized AI Study Tutor for the Study Companion platform — Your Learning. Your Progress. Your Plan. You support students across any subject, examination syllabus, or academic pursuit.

CRITICAL INSTRUCTIONS & GROUNDING RULES:
1. You must STRICTLY base your responses on the provided student notes. Do not hallucinate, speculate, or introduce external syllabus details that are not supported or implied by the provided notes.
2. If the student notes are empty, whitespace, or contain virtually no factual content, respond with an explicit notice: "The selected note has insufficient content. Please write or paste some notes first before running the AI assistant."
3. Maintain an encouraging, academic, clear, and professional tone suitable for competitive exam preparation.
4. For rich text output intended for notes, format with clean HTML compatible with Tiptap (<h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>, <code>). Do not wrap in markdown code blocks like \`\`\`html.
5. For structured responses (Active Recall, Flashcards, Important Points), always adhere strictly to the requested JSON schema.`;

// Notes Assistant Operation Prompts
export type NotesOperation = 'organise' | 'structure' | 'grammar' | 'concise' | 'summary' | 'key_points';

export function getNotesAssistantPrompt(
  operation: NotesOperation,
  noteText: string,
  isSelectionOnly: boolean = false
): string {
  const scopeDescription = isSelectionOnly
    ? 'the selected excerpt of the notes'
    : 'the entire lecture note document';

  switch (operation) {
    case 'organise':
      return `Please organise ${scopeDescription} into well-structured, clear sections.
Group related concepts under logical headings (<h2>, <h3>).
Use bulleted lists (<ul><li>) for items/facts and numbered lists (<ol><li>) for sequential processes or steps.
Highlight key terms with <strong>.
Preserve ALL original facts, dates, names, formulas, and explanations.

INPUT NOTES:
"""
${noteText}
"""

Output ONLY the formatted HTML content ready to be rendered in the rich text editor.`;

    case 'structure':
      return `Please improve the structural hierarchy and logical flow of ${scopeDescription}.
Ensure clear distinction between main concepts (<h2>), sub-topics (<h3>), and explanations (<p>).
Group scattered facts logically so the progression of ideas is easy to revise.
Preserve all factual information.

INPUT NOTES:
"""
${noteText}
"""

Output ONLY the formatted HTML content ready to be rendered in the rich text editor.`;

    case 'grammar':
      return `Please proofread and correct ${scopeDescription}.
Fix all spelling mistakes, grammatical errors, punctuation issues, and awkward sentence structures.
Make the text clear and professional while preserving the student's original tone and EVERY factual detail.

INPUT NOTES:
"""
${noteText}
"""

Output ONLY the formatted HTML content ready to be rendered in the rich text editor.`;

    case 'concise':
      return `Please condense ${scopeDescription} to make it high-yield and concise for rapid exam revision.
Trim redundant wording and fluff by roughly 30% to 50%, while strictly retaining every single factual point, definition, date, formula, and name.
Use bullet points and bold keywords where appropriate.

INPUT NOTES:
"""
${noteText}
"""

Output ONLY the formatted HTML content ready to be rendered in the rich text editor.`;

    case 'summary':
      return `Please create a high-impact, short executive revision summary of ${scopeDescription}.
Include:
1. A brief overview paragraph.
2. 4 to 7 bullet points capturing the core exam-worthy takeaways.
Use <h3>Summary Highlights</h3> and bullet points.

INPUT NOTES:
"""
${noteText}
"""

Output ONLY the formatted HTML content ready to be rendered in the rich text editor.`;

    case 'key_points':
      return `Please extract all essential key points, formulas, definitions, dates, and names from ${scopeDescription}.
Group them into high-yield bulleted points suitable for last-minute revision.
Use <strong> for the key term or date, followed by a concise description.

INPUT NOTES:
"""
${noteText}
"""

Output ONLY the formatted HTML content ready to be rendered in the rich text editor.`;
  }
}

// Revision Centre Prompts
export function getQuickRevisionPrompt(lectureTitle: string, subjectName: string, notes: string): string {
  return `Generate a Quick Revision breakdown for the lecture: "${lectureTitle}" (${subjectName}).
Based exclusively on these notes:
"""
${notes}
"""

Respond in JSON with the following structure:
{
  "quickRecap": "A concise 2-3 paragraph summary of what this lecture covers.",
  "coreConcepts": [
    {
      "title": "Concept Name",
      "summary": "1-2 sentence core explanation"
    }
  ],
  "quickTakeaways": [
    "Key takeaway 1",
    "Key takeaway 2"
  ]
}`;
}

export function getActiveRecallQuestionPrompt(
  lectureTitle: string,
  subjectName: string,
  notes: string,
  previousQuestions: string[] = []
): string {
  const previousClause =
    previousQuestions.length > 0
      ? `Do NOT repeat any of these previously asked questions:\n- ${previousQuestions.join('\n- ')}`
      : '';

  return `Generate ONE high-yield, specific active recall question for the lecture: "${lectureTitle}" (${subjectName}).
The question must test comprehension or factual recall based strictly on the student notes below.
${previousClause}

STUDENT NOTES:
"""
${notes}
"""

Respond in JSON:
{
  "question": "The question to ask the student",
  "difficulty": "easy" | "medium" | "hard",
  "topic": "Specific subtopic or concept tested"
}`;
}

export function getActiveRecallEvaluationPrompt(
  question: string,
  userAnswer: string,
  notes: string
): string {
  return `Evaluate the student's answer to the active recall question.
Ground your evaluation STRICTLY on the student's lecture notes provided.

QUESTION: "${question}"
STUDENT'S ANSWER: "${userAnswer}"
LECTURE NOTES:
"""
${notes}
"""

Respond in JSON:
{
  "isCorrect": boolean, // true if substantially accurate, false if largely wrong or missed critical facts
  "accuracyScore": number, // 0 to 100
  "feedback": "Concise 1-2 sentence evaluation highlighting what was accurate and what was missing",
  "keyMissedPoints": ["Points or facts from the notes that the student omitted, if any"],
  "modelAnswer": "A crisp, model answer based strictly on the notes"
}`;
}

export function getFlashcardsPrompt(lectureTitle: string, subjectName: string, notes: string): string {
  return `Generate 5 to 8 atomic, high-yield flashcards for "${lectureTitle}" (${subjectName}).
Every card must be directly grounded in the student notes below.
Each card must test one specific definition, fact, formula, rule, or concept.

STUDENT NOTES:
"""
${notes}
"""

Respond in JSON:
{
  "flashcards": [
    {
      "id": "card-1",
      "front": "Front question or term to test",
      "back": "Back concise explanation or answer",
      "category": "Definition" | "Fact" | "Formula" | "Concept" | "Date"
    }
  ]
}`;
}

export function getImportantPointsPrompt(lectureTitle: string, subjectName: string, notes: string): string {
  return `Extract and categorize all important points from "${lectureTitle}" (${subjectName}) based strictly on the notes below.

STUDENT NOTES:
"""
${notes}
"""

Respond in JSON:
{
  "definitions": [
    { "term": "Term Name", "explanation": "Clear definition" }
  ],
  "facts": [
    "Crucial fact or statistic from notes"
  ],
  "dates": [
    { "date": "Date or Year", "event": "Associated event or milestone" }
  ],
  "names": [
    { "name": "Important person / act / scheme", "significance": "Significance" }
  ],
  "formulas": [
    { "title": "Formula / Rule Name", "formula": "Formula expression or rule description" }
  ]
}`;
}

export function getWeakAreasPrompt(
  lectureTitle: string,
  subjectName: string,
  userQuery: string,
  notes: string
): string {
  return `The student is studying and finds a concept confusing in "${lectureTitle}" (${subjectName}).
Explain the student's question clearly and simply, using an intuitive analogy or step-by-step breakdown.
Ground your explanation STRICTLY on the student's notes below.

STUDENT'S CONFUSION / QUESTION:
"${userQuery}"

STUDENT'S LECTURE NOTES:
"""
${notes}
"""

Respond in JSON:
{
  "conceptTitle": "Concise title of the concept",
  "simpleExplanation": "Clear, plain-English explanation",
  "analogyOrExample": "A simple everyday analogy or concrete example to make it stick",
  "memoryTip": "A memorable mnemonic, tip, or mental hook to retain it for the exam"
}`;
}

export function getKnowledgeGapsPrompt(
  lectureTitle: string,
  subjectName: string,
  userRecallText: string,
  notes: string
): string {
  return `Compare what the student remembered vs what was recorded in their lecture notes for "${lectureTitle}" (${subjectName}).
Identify missing facts, gaps in understanding, or subtle misconceptions.

STUDENT'S RECALL (What they wrote from memory):
"""
${userRecallText}
"""

ACTUAL SAVED LECTURE NOTES:
"""
${notes}
"""

Respond in JSON:
{
  "summary": "Overall assessment of how much the student remembered (e.g. 70% coverage)",
  "retainedPoints": [
    "Key point accurately remembered"
  ],
  "missedPoints": [
    "Important concept or fact from the notes that was omitted"
  ],
  "misconceptions": [
    "Any fact the student stated incorrectly, with the correction from the notes"
  ],
  "recommendedAction": "1-2 sentence recommendation for what to review next"
}`;
}
