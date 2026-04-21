import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const c of toSet) cookieStore.set(c.name, c.value, c.options)
          } catch {
            // setAll may be invoked from a Server Component where mutating
            // cookies is disallowed. Safe to ignore — the proxy refreshes
            // the session on the next request.
          }
        },
      },
    }
  )
}
