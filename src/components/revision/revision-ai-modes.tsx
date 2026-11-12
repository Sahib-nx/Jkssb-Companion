'use client'

import { useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  FileText,
  Sparkles,
  BrainCircuit,
  Layers,
  KeyRound,
  HelpCircle,
  Search,
  Loader2,
} from 'lucide-react'
import { RecallRating } from '@/lib/spaced-repetition'

const ModeLoadingFallback = () => (
  <div className="flex items-center justify-center p-12 text-zinc-500">
    <Loader2 className="w-5 h-5 animate-spin mr-2 text-blue-400" />
    <span className="text-sm">Loading AI revision mode...</span>
  </div>
)

const QuickRevisionView = dynamic(
  () => import('./modes/quick-revision-view').then((m) => m.QuickRevisionView),
  { loading: ModeLoadingFallback, ssr: false }
)
const ActiveRecallView = dynamic(
  () => import('./modes/active-recall-view').then((m) => m.ActiveRecallView),
  { loading: ModeLoadingFallback, ssr: false }
)
const FlashcardsView = dynamic(
  () => import('./modes/flashcards-view').then((m) => m.FlashcardsView),
  { loading: ModeLoadingFallback, ssr: false }
)
const ImportantPointsView = dynamic(
  () => import('./modes/important-points-view').then((m) => m.ImportantPointsView),
  { loading: ModeLoadingFallback, ssr: false }
)
const WeakAreasView = dynamic(
  () => import('./modes/weak-areas-view').then((m) => m.WeakAreasView),
  { loading: ModeLoadingFallback, ssr: false }
)
const KnowledgeGapsView = dynamic(
  () => import('./modes/knowledge-gaps-view').then((m) => m.KnowledgeGapsView),
  { loading: ModeLoadingFallback, ssr: false }
)
const AiConsentModal = dynamic(
  () => import('@/components/ai/ai-consent-modal').then((m) => m.AiConsentModal),
  { ssr: false }
)

export type RevisionTab =
  | 'notes'
  | 'quick'
  | 'recall'
  | 'flashcards'
  | 'points'
  | 'weak_areas'
  | 'knowledge_gaps'

interface RevisionAiModesProps {
  lectureId: string
  lectureTitle: string
  subjectName: string
  notesText: string
  notesContent: any
  renderOriginalNotes: () => React.ReactNode
  onRecordRecallRating: (rating: RecallRating) => Promise<void>
}

const TABS: { id: RevisionTab; label: string; icon: any; isAi: boolean }[] = [
  { id: 'notes', label: 'Notes', icon: FileText, isAi: false },
  { id: 'quick', label: 'Quick Recap', icon: Sparkles, isAi: true },
  { id: 'recall', label: 'Active Recall', icon: BrainCircuit, isAi: true },
  { id: 'flashcards', label: 'Flashcards', icon: Layers, isAi: true },
  { id: 'points', label: 'Key Points', icon: KeyRound, isAi: true },
  { id: 'weak_areas', label: 'Weak Areas', icon: HelpCircle, isAi: true },
  { id: 'knowledge_gaps', label: 'Knowledge Gaps', icon: Search, isAi: true },
]

export function RevisionAiModes({
  lectureId,
  lectureTitle,
  subjectName,
  notesText,
  notesContent,
  renderOriginalNotes,
  onRecordRecallRating,
}: RevisionAiModesProps) {
  const [activeTab, setActiveTab] = useState<RevisionTab>('notes')
  const [isConsentOpen, setIsConsentOpen] = useState(false)
  const [pendingTab, setPendingTab] = useState<RevisionTab | null>(null)

  const handleTabClick = (tab: RevisionTab) => {
    const isAiTab = tab !== 'notes'
    if (isAiTab) {
      const hasConsented =
        typeof window !== 'undefined' && localStorage.getItem('mts_ai_consent') === 'true'
      if (!hasConsented) {
        setPendingTab(tab)
        setIsConsentOpen(true)
        return
      }
    }
    setActiveTab(tab)
  }

  const handleConsentGranted = () => {
    setIsConsentOpen(false)
    if (pendingTab) {
      setActiveTab(pendingTab)
      setPendingTab(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation Pill Bar */}
      <div className="flex items-center space-x-1.5 p-1 bg-[#11141D] border border-white/10 rounded-xl overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 min-h-[36px] ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : tab.isAi ? 'text-purple-400' : 'text-zinc-400'}`} />
              <span>{tab.label}</span>
              {tab.isAi && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60" />
              )}
            </button>
          )
        })}
      </div>

      {/* BYOK Status & Grounding Context */}
      {activeTab !== 'notes' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-zinc-400 px-1 gap-1">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>AI Revision is grounded strictly on your lecture notes.</span>
          </div>
          <Link
            href="/dashboard/settings"
            className="text-purple-400 hover:text-purple-300 underline underline-offset-2 self-start sm:self-auto shrink-0"
          >
            Manage Gemini API Key
          </Link>
        </div>
      )}

      {/* Tab Content Views */}
      <div className="min-h-[400px]">
        {activeTab === 'notes' && (
          <div className="p-4 sm:p-6 md:p-8 rounded-xl border border-white/10 bg-[#11141D] shadow-sm">
            {renderOriginalNotes()}
          </div>
        )}

        {activeTab === 'quick' && (
          <QuickRevisionView
            lectureId={lectureId}
            lectureTitle={lectureTitle}
            subjectName={subjectName}
            notesText={notesText}
            notesContent={notesContent}
            renderOriginalNotes={renderOriginalNotes}
          />
        )}

        {activeTab === 'recall' && (
          <ActiveRecallView
            lectureId={lectureId}
            lectureTitle={lectureTitle}
            subjectName={subjectName}
            notesText={notesText}
            onRecordRecallRating={onRecordRecallRating}
          />
        )}

        {activeTab === 'flashcards' && (
          <FlashcardsView
            lectureId={lectureId}
            lectureTitle={lectureTitle}
            subjectName={subjectName}
            notesText={notesText}
          />
        )}

        {activeTab === 'points' && (
          <ImportantPointsView
            lectureId={lectureId}
            lectureTitle={lectureTitle}
            subjectName={subjectName}
            notesText={notesText}
          />
        )}

        {activeTab === 'weak_areas' && (
          <WeakAreasView
            lectureId={lectureId}
            lectureTitle={lectureTitle}
            subjectName={subjectName}
            notesText={notesText}
          />
        )}

        {activeTab === 'knowledge_gaps' && (
          <KnowledgeGapsView
            lectureId={lectureId}
            lectureTitle={lectureTitle}
            subjectName={subjectName}
            notesText={notesText}
          />
        )}
      </div>

      {/* Consent Modal */}
      {isConsentOpen && (
        <AiConsentModal
          isOpen={isConsentOpen}
          onClose={() => {
            setIsConsentOpen(false)
            setPendingTab(null)
          }}
          onConsentGranted={handleConsentGranted}
        />
      )}
    </div>
  )
}
