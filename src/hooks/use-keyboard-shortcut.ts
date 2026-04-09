'use client'

import { useEffect } from 'react'

type Key = string
type Modifier = 'ctrl' | 'meta' | 'shift' | 'alt'

interface ShortcutOptions {
  key: Key
  modifiers?: Modifier[]
  handler: () => void
  enabled?: boolean
}

export function useKeyboardShortcut({ key, modifiers = [], handler, enabled = true }: ShortcutOptions) {
  useEffect(() => {
    if (!enabled) return

    function onKeyDown(e: KeyboardEvent) {
      const matchKey = e.key.toLowerCase() === key.toLowerCase()
      const matchCtrl = modifiers.includes('ctrl') ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey)
      const matchShift = modifiers.includes('shift') ? e.shiftKey : !e.shiftKey
      const matchAlt = modifiers.includes('alt') ? e.altKey : !e.altKey

      // Don't trigger in input/textarea/contenteditable
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Exception: Escape always works
        if (key.toLowerCase() !== 'escape') return
      }

      if (matchKey && matchCtrl && matchShift && matchAlt) {
        e.preventDefault()
        handler()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [key, modifiers, handler, enabled])
}
