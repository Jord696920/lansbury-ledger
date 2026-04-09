'use client'

import { useState, useEffect, useRef } from 'react'

/** Animate a number counting up/down over `duration` ms */
export function useAnimatedNumber(target: number, duration = 600): number {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const from = prevRef.current
    const diff = target - from
    if (diff === 0) return

    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = from + diff * eased

      setDisplay(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        prevRef.current = target
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return display
}
