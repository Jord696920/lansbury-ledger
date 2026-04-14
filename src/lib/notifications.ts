export type NotificationStatus = 'default' | 'granted' | 'denied' | 'unsupported'

export function getNotificationStatus(): NotificationStatus {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission as NotificationStatus
}

export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  const result = await Notification.requestPermission()
  return result as NotificationStatus
}

interface ShowNotificationOptions {
  body: string
  tag?: string
  url?: string
  requireInteraction?: boolean
}

export async function showLocalNotification(
  title: string,
  options: ShowNotificationOptions,
): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false
  }

  // Prefer SW-based notifications (allows click handling, persistence)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, {
        body: options.body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: options.tag ?? 'rod-notification',
        requireInteraction: options.requireInteraction ?? false,
        data: { url: options.url ?? '/' },
      })
      return true
    } catch {
      // Fall through to direct Notification below
    }
  }

  try {
    new Notification(title, {
      body: options.body,
      icon: '/icons/icon-192.png',
      tag: options.tag ?? 'rod-notification',
    })
    return true
  } catch {
    return false
  }
}
