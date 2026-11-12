'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Sparkles,
  ShieldCheck,
  Power,
  KeyRound,
  ExternalLink,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Lock,
  Loader2,
  Info,
  Clock,
} from 'lucide-react'
import {
  UserAiClientConfig,
  connectGeminiApiKey,
  testCurrentApiKey,
  disconnectGeminiApiKey,
  toggleUserAiEnabled,
} from '@/lib/ai/byok-actions'
import { GEMINI_CONFIG } from '@/lib/ai/config'
import { useToast } from '@/components/ui/toast'

interface AiSettingsCardProps {
  initialConfig: UserAiClientConfig
}

export function AiSettingsCard({ initialConfig }: AiSettingsCardProps) {
  const toast = useToast()
  const [config, setConfig] = useState<UserAiClientConfig>(initialConfig)

  // Form states
  const [isReplacingKey, setIsReplacingKey] = useState(!initialConfig.is_configured)
  const [inputKey, setInputKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [consentChecked, setConsentChecked] = useState(initialConfig.consent_given)

  // Loading states
  const [isConnecting, setIsConnecting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isTogglingAi, setIsTogglingAi] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  // Race-condition & duplicate request guards
  const connectReqIdRef = useRef(0)
  const testReqIdRef = useRef(0)

  // Connect or replace key with client timeout safeguard & race-condition cancellation
  const handleConnectKey = async (e: React.FormEvent) => {
    e.preventDefault()

    // 1. Guard against duplicate rapid submissions
    if (isConnecting) return

    const trimmed = inputKey.trim()
    if (!trimmed) {
      toast.error('Please enter your Google Gemini API key.')
      return
    }

    if (!consentChecked) {
      toast.error('Please accept the privacy and API key connection consent.')
      return
    }

    setIsConnecting(true)
    const currentReqId = ++connectReqIdRef.current

    try {
      // Client-side safeguard timeout (14 seconds) to guarantee the UI never hangs
      const clientTimeout = new Promise<{
        success: false
        error: string
        timedOut: true
      }>((resolve) => {
        setTimeout(() => {
          resolve({
            success: false,
            error: 'Connection request timed out. Google Gemini did not respond within 14 seconds. Please check your network and retry.',
            timedOut: true,
          })
        }, 14000)
      })

      const res = await Promise.race([
        connectGeminiApiKey(trimmed),
        clientTimeout,
      ])

      // 2. Race condition check: Ignore if user initiated another request
      if (currentReqId !== connectReqIdRef.current) {
        return
      }

      if (res.success && res.keyHint) {
        // Immediate UI synchronization without requiring page refresh
        setConfig((prev) => ({
          ...prev,
          is_configured: true,
          ai_enabled: true,
          key_hint: res.keyHint!,
          consent_given: true,
          last_validated_at: new Date().toISOString(),
          error: undefined,
        }))
        setInputKey('')
        setIsReplacingKey(false)
        const durationSec = res.timingMs ? ` in ${(res.timingMs / 1000).toFixed(1)}s` : ''
        toast.success(`Google Gemini API key connected, verified, and encrypted${durationSec}!`)
      } else {
        // Key replacement safety: If replacing an existing key, the old key remains intact
        const existingHint = config.is_configured
          ? ' Your previously saved key was preserved.'
          : ''
        toast.error((res.error || 'Failed to connect Gemini API key.') + existingHint)
      }
    } catch (err: any) {
      if (currentReqId === connectReqIdRef.current) {
        toast.error(err?.message || 'Error connecting API key.')
      }
    } finally {
      if (currentReqId === connectReqIdRef.current) {
        setIsConnecting(false)
      }
    }
  }

  // Test currently connected key with timing and timeout guard
  const handleTestConnection = async () => {
    if (isTesting || !config.is_configured) return

    setIsTesting(true)
    const currentReqId = ++testReqIdRef.current

    try {
      const clientTimeout = new Promise<{
        success: false
        error: string
      }>((resolve) => {
        setTimeout(() => {
          resolve({
            success: false,
            error: 'Test connection timed out. Google Gemini did not respond within 14 seconds.',
          })
        }, 14000)
      })

      const res = await Promise.race([testCurrentApiKey(), clientTimeout])

      if (currentReqId !== testReqIdRef.current) {
        return
      }

      if (res.success) {
        setConfig((prev) => ({
          ...prev,
          last_validated_at: new Date().toISOString(),
        }))
        const durationSec = res.timingMs ? ` in ${(res.timingMs / 1000).toFixed(1)}s` : ''
        toast.success(`Connection verified${durationSec}! Your Gemini API key is valid and responsive.`)
      } else {
        toast.error(res.error || 'Test connection failed. Please check your key.')
      }
    } catch (err: any) {
      if (currentReqId === testReqIdRef.current) {
        toast.error(err?.message || 'Error testing connection.')
      }
    } finally {
      if (currentReqId === testReqIdRef.current) {
        setIsTesting(false)
      }
    }
  }

  // Disconnect key
  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      const res = await disconnectGeminiApiKey()
      if (res.success) {
        setConfig((prev) => ({
          ...prev,
          is_configured: false,
          ai_enabled: false,
          key_hint: null,
          last_validated_at: null,
        }))
        setShowDisconnectConfirm(false)
        setIsReplacingKey(true)
        setInputKey('')
        toast.info('Gemini API key disconnected and encrypted credentials wiped.')
      } else {
        toast.error(res.error || 'Failed to disconnect API key.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error disconnecting API key.')
    } finally {
      setIsDisconnecting(false)
    }
  }

  // Toggle AI enabled/disabled
  const handleToggleAi = async () => {
    if (!config.is_configured && !config.ai_enabled) {
      toast.error('Connect a Gemini API key first before enabling AI.')
      setIsReplacingKey(true)
      return
    }

    setIsTogglingAi(true)
    const nextState = !config.ai_enabled
    try {
      const res = await toggleUserAiEnabled(nextState)
      if (res.success) {
        setConfig((prev) => ({ ...prev, ai_enabled: nextState }))
        toast.success(nextState ? 'AI features enabled.' : 'AI features disabled.')
      } else {
        toast.error(res.error || 'Failed to toggle AI features.')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating AI status.')
    } finally {
      setIsTogglingAi(false)
    }
  }

  // Format date helper
  const formatValidationDate = (isoStr: string | null) => {
    if (!isoStr) return 'Not verified yet'
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Recently'
    }
  }

  return (
    <Card className="border-purple-500/25 bg-[#11141D] shadow-xl overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-3 border-b border-zinc-800/80 bg-white/[0.01]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <CardTitle className="text-base sm:text-lg text-white font-semibold">
                  AI Study Assistant & Privacy
                </CardTitle>
                <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-300 border-purple-500/30">
                  BYOK
                </Badge>
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                Connect your personal Google Gemini API key for private, encrypted AI study features
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-center">
            {config.is_configured ? (
              <Badge
                variant={config.ai_enabled ? 'default' : 'secondary'}
                className={
                  config.ai_enabled
                    ? 'bg-emerald-600/90 hover:bg-emerald-600 text-white border-0'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    config.ai_enabled ? 'bg-emerald-300 animate-pulse' : 'bg-zinc-500'
                  }`}
                />
                {config.ai_enabled ? 'Active & Connected' : 'Connected (Disabled)'}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/10">
                <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-amber-400" />
                API Key Required
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5 text-zinc-300 text-xs">
        {/* Supabase Schema Alert (if table not created yet) */}
        {config.error && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-1">
              <span className="font-semibold text-white block">Database Migration Pending</span>
              <span>{config.error}</span>
            </div>
          </div>
        )}

        {/* Configuration Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800/80">
            <span className="text-[11px] text-zinc-500 uppercase font-semibold block mb-1">
              AI Provider
            </span>
            <div className="flex items-center space-x-1.5 font-medium text-white">
              <span>Google Gemini</span>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 inline-flex items-center ml-1"
                title="Open Google AI Studio"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              Direct BYOK Integration
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800/80">
            <span className="text-[11px] text-zinc-500 uppercase font-semibold block mb-1">
              Connected API Key
            </span>
            {config.is_configured && config.key_hint ? (
              <div className="flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono text-zinc-200 font-semibold truncate">
                  {config.key_hint}
                </span>
              </div>
            ) : (
              <span className="text-amber-400 font-medium">None configured</span>
            )}
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              AES-256-GCM Encrypted
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800/80">
            <span className="text-[11px] text-zinc-500 uppercase font-semibold block mb-1">
              Centrally Fixed Model
            </span>
            <span className="font-mono text-purple-300 font-semibold block truncate">
              {GEMINI_CONFIG.DISPLAY_NAME}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              Strict Single-Model Policy
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800/80">
            <span className="text-[11px] text-zinc-500 uppercase font-semibold block mb-1">
              Last Verified
            </span>
            <span className="text-zinc-300 font-medium block truncate">
              {formatValidationDate(config.last_validated_at)}
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              Fast &lt;1s Health Check
            </span>
          </div>
        </div>

        {/* Form: Connect / Replace Key */}
        {isReplacingKey ? (
          <form
            onSubmit={handleConnectKey}
            className="p-4 sm:p-5 rounded-2xl bg-[#0E1017] border border-purple-500/20 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-purple-400 shrink-0" />
                <h4 className="font-semibold text-white text-sm">
                  {config.is_configured ? 'Replace Gemini API Key' : 'Connect Your Google Gemini API Key'}
                </h4>
              </div>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center self-start sm:self-auto font-medium"
              >
                Get Free API Key on Google AI Studio
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>

            {/* Quick 3-Step Guide */}
            <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 text-[11px] text-zinc-300 space-y-1">
              <div className="font-semibold text-purple-300 flex items-center mb-1">
                <Info className="w-3.5 h-3.5 mr-1 text-purple-400" />
                How to get your free Gemini API key:
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-zinc-400">
                <li>
                  Open{' '}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-300 underline underline-offset-2"
                  >
                    Google AI Studio
                  </a>{' '}
                  and sign in with your Google account.
                </li>
                <li>Click <strong>Create API key</strong> (100% free with no credit card required).</li>
                <li>Paste your key below. It will validate with {GEMINI_CONFIG.DISPLAY_NAME} and encrypt immediately.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <label htmlFor="gemini-key-input" className="block text-xs font-medium text-zinc-300">
                Gemini API Key
              </label>
              <div className="relative">
                <Input
                  id="gemini-key-input"
                  type={showKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  disabled={isConnecting}
                  className="bg-[#0B0D12] border-zinc-800 text-white font-mono text-xs pr-10 focus:border-purple-500 h-10"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  tabIndex={-1}
                  disabled={isConnecting}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Consent Checkbox */}
            <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                disabled={isConnecting}
                className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-purple-600 focus:ring-purple-500 w-4 h-4"
              />
              <span className="text-[11px] text-zinc-400 leading-relaxed">
                I agree to connect my Gemini API key. Data from my study notes will be transmitted
                directly to Google Gemini for study assistance, grounded strictly in my notes, and
                encrypted with AES-256-GCM at rest.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {config.is_configured && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsReplacingKey(false)
                    setInputKey('')
                  }}
                  disabled={isConnecting}
                  className="border-zinc-800 text-zinc-400 hover:text-white h-9"
                >
                  Cancel (Keep Existing Key)
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={isConnecting || !inputKey.trim()}
                className="bg-purple-600 hover:bg-purple-500 text-white font-medium h-9 min-w-[150px]"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                    Validating Key...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                    {config.is_configured ? 'Verify & Replace Key' : 'Connect & Encrypt Key'}
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* Controls when already connected */
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E1017] border border-zinc-800/80 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-white font-semibold text-sm">Key Connected & Operational</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Key hint <code className="text-purple-300 font-mono">{config.key_hint}</code> is
                  actively powering your AI Notes and Revision assistants via {GEMINI_CONFIG.DISPLAY_NAME}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting || isDisconnecting}
                  className="border-zinc-800 text-zinc-300 hover:text-white h-8 text-xs"
                >
                  {isTesting ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="w-3 h-3 mr-1.5 text-blue-400" />
                  )}
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsReplacingKey(true)}
                  disabled={isTesting || isDisconnecting}
                  className="border-zinc-800 text-zinc-300 hover:text-white h-8 text-xs"
                >
                  <KeyRound className="w-3 h-3 mr-1.5 text-purple-400" />
                  Replace Key
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisconnectConfirm(true)}
                  disabled={isTesting || isDisconnecting}
                  className="border-zinc-800 text-rose-400 hover:text-rose-300 hover:border-rose-900/50 h-8 text-xs"
                >
                  <Trash2 className="w-3 h-3 mr-1.5" />
                  Disconnect
                </Button>
              </div>
            </div>

            {/* Disconnect Confirmation Alert */}
            {showDisconnectConfirm && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 space-y-2 mt-3 animate-in fade-in">
                <div className="flex items-center space-x-2 text-rose-300 font-medium text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Are you sure you want to disconnect your Gemini API key?</span>
                </div>
                <p className="text-[11px] text-rose-300/80">
                  Your encrypted key credentials will be permanently erased from Supabase. AI features
                  will be disabled until you enter a key again.
                </p>
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDisconnectConfirm(false)}
                    disabled={isDisconnecting}
                    className="text-zinc-400 hover:text-white h-7 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    className="h-7 text-xs bg-rose-600 hover:bg-rose-500"
                  >
                    {isDisconnecting ? (
                      <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    ) : null}
                    Confirm Disconnect
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Master AI Toggle & Security Architecture Footer */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t border-zinc-800/80 gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-white font-medium text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>AES-256-GCM Hardware-Encrypted Security Guarantee</span>
            </div>
            <p className="text-[11px] text-zinc-400 max-w-xl leading-relaxed">
              Keys are encrypted server-side before storage, isolated strictly by Row Level Security
              (RLS), and never sent to browser scripts, logs, or platform administrators.
            </p>
          </div>

          <div className="w-full sm:w-auto flex justify-end">
            <Button
              type="button"
              variant={config.ai_enabled ? 'destructive' : 'default'}
              size="sm"
              onClick={handleToggleAi}
              disabled={isTogglingAi || !config.is_configured}
              className={`h-9 text-xs font-semibold w-full sm:w-auto min-w-[120px] ${
                config.ai_enabled
                  ? 'bg-rose-600/90 hover:bg-rose-600 text-white'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {isTogglingAi ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <Power className="w-3.5 h-3.5 mr-1.5" />
              )}
              {config.ai_enabled ? 'Disable AI Features' : 'Enable AI Features'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
