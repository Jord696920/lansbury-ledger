'use client'

import { useEffect, useState } from 'react'
import {
  getNotificationStatus,
  requestNotificationPermission,
  showLocalNotification,
  type NotificationStatus,
} from '@/lib/notifications'

export function NotificationsToggle() {
  const [status, setStatus] = useState<NotificationStatus>('unsupported')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setStatus(getNotificationStatus())
  }, [])

  const handleClick = async () => {
    if (pending) return
    setPending(true)
    try {
      const result = await requestNotificationPermission()
      setStatus(result)
      if (result === 'granted') {
        await showLocalNotification('Rod', {
          body: "Notifications enabled. You won't miss a deadline.",
          tag: 'rod-onboarding',
        })
      }
    } finally {
      setPending(false)
    }
  }

  if (status === 'unsupported') {
    return (
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium text-text-primary">Push notifications</p>
          <p className="text-xs text-text-secondary">
            Your browser doesn&apos;t support notifications.
          </p>
        </div>
      </div>
    )
  }

  const label =
    status === 'granted'
      ? '✓ Enabled'
      : status === 'denied'
        ? 'Blocked — enable in browser settings'
        : 'Enable'

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-text-primary">Push notifications</p>
        <p className="text-xs text-text-secondary">
          BAS reminders, weekly pulse, invoice updates.
        </p>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || status === 'granted' || status === 'denied'}
        className="shrink-0 rounded-xl border border-border-subtle bg-bg-primary px-4 py-2 text-xs font-medium text-text-primary hover:bg-bg-secondary disabled:opacity-60"
      >
        {pending ? 'Requesting…' : label}
      </button>
    </div>
  )
}
