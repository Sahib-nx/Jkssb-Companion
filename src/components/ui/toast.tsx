'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  message: string
  title?: string
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      setToasts((prev) => [...prev, { id, type, message, title }])

      // Auto-dismiss after 3500ms
      setTimeout(() => {
        removeToast(id)
      }, 3500)
    },
    [removeToast]
  )

  const success = useCallback(
    (message: string, title?: string) => showToast(message, 'success', title),
    [showToast]
  )

  const error = useCallback(
    (message: string, title?: string) => showToast(message, 'error', title),
    [showToast]
  )

  const info = useCallback(
    (message: string, title?: string) => showToast(message, 'info', title),
    [showToast]
  )

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      {/* Toast Notification Container */}
      <aside
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border border-white/10 bg-[#11141D]/95 backdrop-blur-md shadow-2xl transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              {t.type === 'error' && (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              {t.type === 'info' && (
                <Info className="w-4 h-4 text-blue-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {t.title && (
                <p className="text-xs font-semibold text-white mb-0.5">{t.title}</p>
              )}
              <p className="text-xs text-zinc-300 leading-snug">{t.message}</p>
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 p-1 rounded-md text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </aside>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
