'use client'

import { useEffect, useState } from 'react'

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!mounted || isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] bg-[var(--accent-amber-bg,#FEF3C7)] text-[var(--accent-amber,#92400E)] text-center text-xs sm:text-sm py-2 font-medium px-4 shadow-sm"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      You&apos;re offline — showing cached data
    </div>
  )
}
