'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const DISMISS_KEY = 'rod-install-dismissed-at'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Already installed → never show
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Dismissed recently → skip
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) return

    let timer: ReturnType<typeof setTimeout> | null = null

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      timer = setTimeout(() => setShowPrompt(true), 30_000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    const onInstalled = () => {
      setShowPrompt(false)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    try {
      await deferredPrompt.userChoice
    } catch {
      // user gesture may have been cancelled — safe to ignore
    }
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // Storage unavailable — banner simply won't respect cooldown
    }
  }

  if (!showPrompt) return null

  return (
    <div
      role="dialog"
      aria-label="Install Rod"
      className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50
                 bg-[var(--bg-primary)] rounded-2xl shadow-lg border border-[var(--border-subtle)] p-5"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#1B3A6B] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-lg leading-none">R</span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-[var(--text-primary)]">
            Install Rod
          </p>
          <p className="text-[var(--text-secondary)] text-xs mt-0.5">
            Add to your home screen for faster access and a native app
            experience.
          </p>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-1 text-sm text-[var(--text-secondary)] py-2"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={handleInstall}
          className="flex-1 bg-[#1B3A6B] text-white text-sm font-medium py-2 rounded-xl hover:bg-[#16315c] transition-colors"
        >
          Install
        </button>
      </div>
    </div>
  )
}
