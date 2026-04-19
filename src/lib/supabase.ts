import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _anonClient: SupabaseClient | null = null

function getAnonClient(): SupabaseClient {
  if (_anonClient) return _anonClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase env vars missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).'
    )
  }
  _anonClient = createClient(url, key)
  return _anonClient
}

// Proxy so `supabase.from(...)`, `supabase.auth`, etc. still work at call-sites,
// but the real createClient() only runs on first property access — not at
// module evaluation. This stops Next's page-data collection from crashing when
// the build runs without NEXT_PUBLIC_SUPABASE_* set.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getAnonClient()
    const value = (client as unknown as Record<string | symbol, unknown>)[prop as string]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
})

// Server-side client with service role key (for API routes only).
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase service env vars missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'
    )
  }
  return createClient(url, key)
}
