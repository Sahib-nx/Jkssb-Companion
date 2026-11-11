'use client'

import { useState } from 'react'
import {
  FileText,
  Sparkles,
  BrainCircuit,
  Layers,
  KeyRound,
  HelpCircle,
  Search,
} from 'lucide-react'
import { QuickRevisionView } from './modes/quick-revision-view'
import { ActiveRecallView } from './modes/active-recall-view'
import { FlashcardsView } from './modes/flashcards-view'
import { ImportantPointsView } from './modes/important-points-view'
import { WeakAreasView } from './modes/weak-areas-view'
import { KnowledgeGapsView } from './modes/knowledge-gaps-view'
import { AiConsentModal } from '@/components/ai/ai-consent-modal'
import { RecallRating } from '@/lib/spaced-repetition'

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
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm'
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

      {/* Tab Content Views */}
      <div className="min-h-[400px]">
        {activeTab === 'notes' && (
          <div className="p-6 md:p-8 rounded-xl border border-white/10 bg-[#11141D] shadow-sm">
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
      <AiConsentModal
        isOpen={isConsentOpen}
        onClose={() => {
          setIsConsentOpen(false)
          setPendingTab(null)
        }}
        onConsentGranted={handleConsentGranted}
      />
    </div>
  )
}
