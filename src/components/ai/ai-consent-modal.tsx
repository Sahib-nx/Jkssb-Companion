'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, ShieldCheck, AlertCircle, X, Check } from 'lucide-react'
import { recordUserAiConsent } from '@/lib/ai/consent-actions'

interface AiConsentModalProps {
  isOpen: boolean
  onClose: () => void
  onConsentGranted: () => void
}

export function AiConsentModal({ isOpen, onClose, onConsentGranted }: AiConsentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleAccept = async () => {
    setIsSubmitting(true)
    try {
      await recordUserAiConsent()
      if (typeof window !== 'undefined') {
        localStorage.setItem('mts_ai_consent', 'true')
      }
      onConsentGranted()
    } catch (err) {
      console.error('Error saving consent:', err)
      onConsentGranted()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#11141D] border border-white/10 rounded-2xl shadow-2xl p-4.5 sm:p-6 md:p-8 text-zinc-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          disabled={isSubmitting}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Enable AI Study Assistant</h3>
            <p className="text-xs text-zinc-400">Powered by Google Gemini (BYOK)</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-zinc-300">
          <div className="p-3.5 rounded-xl bg-purple-500/5 border border-purple-500/20 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-zinc-300">
              <strong className="text-white block mb-0.5">Strict Grounding on Your Notes</strong>
              The AI assistant is strictly bound to your own typed lecture notes to generate revisions, flashcards, and active recall tests. It does not introduce hallucinated syllabus content.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-zinc-300">
              <strong className="text-white block mb-0.5">Private Bring Your Own Key (BYOK)</strong>
              Your study notes are processed using your personal Google Gemini API key. Credentials are encrypted with hardware AES-256-GCM at rest, never shared across students, and never used to train public AI models.
            </div>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            You can revoke your consent or turn off AI assistance at any time from your Account Settings page.
          </p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-full sm:w-auto text-xs border-white/10 text-zinc-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isSubmitting}
            className="w-full sm:w-auto text-xs bg-purple-600 hover:bg-purple-500 text-white font-medium"
          >
            {isSubmitting ? (
              'Enabling...'
            ) : (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                I Understand & Agree
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
