'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="h-9 w-9 rounded-lg bg-bg-elevated" />
  }

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => {
        document.documentElement.classList.add('theme-transition')
        setTheme(isDark ? 'light' : 'dark')
        setTimeout(() => document.documentElement.classList.remove('theme-transition'), 350)
      }}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-bg-elevated hover:text-text-secondary"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  )
}
