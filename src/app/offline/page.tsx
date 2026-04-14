import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[var(--bg-primary)]">
      <div className="w-20 h-20 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[var(--text-secondary)]"
        >
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold mb-2 text-[var(--text-primary)]">
        You&apos;re offline
      </h1>
      <p className="text-[var(--text-secondary)] mb-6 max-w-sm text-sm">
        Rod needs an internet connection to load your latest data. Your most
        recent dashboard is cached and available.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#1B3A6B] text-white text-sm font-medium hover:bg-[#16315c] transition-colors"
      >
        View cached dashboard
      </Link>
    </main>
  )
}
