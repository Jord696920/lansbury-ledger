import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Routes that authenticated users shouldn't see (they bounce to /dashboard).
const PUBLIC_ONLY = ['/login']

// Anything not matched by the matcher below is left alone (e.g. _next, api).
// All other routes require auth.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const c of toSet) request.cookies.set(c.name, c.value)
          response = NextResponse.next({ request })
          for (const c of toSet) response.cookies.set(c.name, c.value, c.options)
        },
      },
    }
  )

  // Touching getUser() refreshes the session cookies if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isPublicOnly = PUBLIC_ONLY.includes(path)

  if (!user && !isPublicOnly) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (user && isPublicOnly) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Run on every request except next internals, api routes, static files,
    // PWA assets, and image optimisation paths. Auth is enforced for the
    // app shell and skipped for API routes (those use api-guard.ts /
    // service role).
    '/((?!_next/static|_next/image|api|favicon.ico|sw.js|workbox-.*|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|js|woff2)).*)',
  ],
}
