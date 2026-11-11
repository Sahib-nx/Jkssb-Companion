'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, ShieldCheck, Power, RotateCcw, Loader2 } from 'lucide-react'
import { updateAiSettings, UserAiPreferences } from '@/lib/ai/consent-actions'
import { useToast } from '@/components/ui/toast'

interface AiSettingsCardProps {
  initialPreferences: UserAiPreferences
}

export function AiSettingsCard({ initialPreferences }: AiSettingsCardProps) {
  const toast = useToast()
  const [prefs, setPrefs] = useState<UserAiPreferences>(initialPreferences)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleToggleAi = async () => {
    setIsUpdating(true)
    const nextState = !prefs.ai_enabled
    try {
      const res = await updateAiSettings({ ai_enabled: nextState })
      if (res.success) {
        setPrefs((p) => ({ ...p, ai_enabled: nextState }))
        toast.success(nextState ? 'AI features enabled.' : 'AI features disabled.')
      } else {
        toast.error(res.error || 'Failed to update setting')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating AI setting')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRevokeConsent = async () => {
    setIsUpdating(true)
    try {
      const res = await updateAiSettings({ revoke_consent: true })
      if (res.success) {
        setPrefs((p) => ({ ...p, consent_given: false, consented_at: null }))
        if (typeof window !== 'undefined') {
          localStorage.removeItem('mts_ai_consent')
        }
        toast.info('AI consent revoked. You will be prompted again before using AI.')
      } else {
        toast.error(res.error || 'Failed to revoke consent')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error revoking consent')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className="border-purple-500/20 bg-[#11141D]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded bg-purple-500/20 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <CardTitle className="text-base text-white">AI Study Assistant & Privacy</CardTitle>
          </div>
          <Badge
            variant={prefs.ai_enabled ? 'default' : 'secondary'}
            className={prefs.ai_enabled ? 'bg-purple-600 text-white' : 'text-zinc-400'}
          >
            {prefs.ai_enabled ? 'Active' : 'Disabled'}
          </Badge>
        </div>
        <CardDescription className="text-xs text-zinc-400">
          Configure Google Gemini integration, privacy consent, and study assistant preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs text-zinc-300">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-[#0B0D12] border border-zinc-800">
            <span className="text-zinc-500 block mb-0.5">Configured Model</span>
            <span className="font-semibold text-white font-mono">{prefs.preferred_model}</span>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0D12] border border-zinc-800">
            <span className="text-zinc-500 block mb-0.5">Privacy Consent</span>
            <span className={`font-semibold ${prefs.consent_given ? 'text-emerald-400' : 'text-amber-400'}`}>
              {prefs.consent_given ? 'Consent Granted' : 'Not Granted Yet'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0D12] border border-zinc-800">
            <span className="text-zinc-500 block mb-0.5">Grounding Policy</span>
            <span className="font-semibold text-purple-300">Notes-Only Strict Grounding</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-3 border-t border-zinc-800/60 gap-3">
          <div className="text-[11px] text-zinc-400 space-y-0.5">
            <div className="flex items-center text-zinc-300">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400 mr-1.5" />
              API credentials are kept exclusively server-side and never exposed to the client.
            </div>
            <div>Free-tier rate limits and strict user session isolation apply.</div>
          </div>

          <div className="flex items-center space-x-2">
            {prefs.consent_given && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokeConsent}
                disabled={isUpdating}
                className="h-8 text-xs border-zinc-800 text-zinc-400 hover:text-white"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Revoke Consent
              </Button>
            )}

            <Button
              variant={prefs.ai_enabled ? 'destructive' : 'default'}
              size="sm"
              onClick={handleToggleAi}
              disabled={isUpdating}
              className={`h-8 text-xs font-medium ${
                prefs.ai_enabled ? '' : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {isUpdating ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Power className="w-3 h-3 mr-1" />
              )}
              {prefs.ai_enabled ? 'Disable AI' : 'Enable AI'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
