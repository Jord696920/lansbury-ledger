import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser client with cookie-backed session (so the proxy + RLS see the
// signed-in user). Replaces the previous in-memory createClient call so
// every existing `supabase.from(...)` import gets auth for free.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key (for API routes only — never
// reach for this from a browser bundle, it bypasses RLS).
export function createServiceClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
