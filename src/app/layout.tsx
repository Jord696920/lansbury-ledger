import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/ui/theme-provider'
import { SWRProvider } from '@/components/swr-provider'
import { ServiceWorkerRegister } from '@/components/layout/sw-register'
import { OfflineBanner } from '@/components/layout/offline-banner'
import { InstallPrompt } from '@/components/layout/install-prompt'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Rod | Dashboard', template: 'Rod | %s' },
  description: 'Your books. Your control. No accountant required.',
  applicationName: 'Rod',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }],
    shortcut: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rod',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Rod',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1B3A6B' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0F1A' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`h-full ${jakarta.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body className="h-full">
        <ThemeProvider>
          <SWRProvider>
            <OfflineBanner />
            {children}
            <InstallPrompt />
            <ServiceWorkerRegister />
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
