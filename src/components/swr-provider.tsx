'use client'

import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        dedupingInterval: 30_000,
        shouldRetryOnError: true,
        errorRetryCount: 3,
      }}
    >
      {children}
    </SWRConfig>
  )
}
