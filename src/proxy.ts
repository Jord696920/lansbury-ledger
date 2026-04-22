import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Routes that authenticated users shouldn't see (they bounce to /dashboard).
const PUBLIC_ONLY = ['/login']

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
        setAll(cookiesToSet) {
          // 1) Update the incoming request so the next getAll() sees fresh cookies
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // 2) Create a new response carrying the updated request cookies
          response = NextResponse.next({ request })
          // 3) Write the refreshed cookies onto the OUTGOING response so the browser persists them
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() triggers token refresh + writes new cookies via setAll above
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Unauthenticated users hitting a protected route → /login?next=...
  if (!user && !PUBLIC_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated users hitting /login → /dashboard
  if (user && PUBLIC_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    // Match all paths except Next internals, static files, and public assets
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js|robots.txt|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}
