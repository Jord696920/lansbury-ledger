// Lightweight API-route guards: same-origin + in-memory rate limiting.
// Goal: stop drive-by abuse of /api/* from other origins and from script floods.
// NOT a replacement for real auth. Flagged for Jordan: add Supabase Auth session checks
// once he's ready for the UX churn.

import type { NextRequest } from 'next/server'

/**
 * Verify the request originates from an allowed host.
 * Checks `Origin` (browsers send this on all cross-origin + credentialed fetches)
 * and falls back to `Referer`. Returns `null` if OK, or a Response to return.
 */
export function checkSameOrigin(request: Request | NextRequest): Response | null {
  const allowed = new Set<string>()
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) allowed.add(new URL(configured).host)

  // Always allow requests from the deployed host itself
  const selfHost = request.headers.get('host')
  if (selfHost) allowed.add(selfHost)
  // Localhost + Vercel preview fallthrough
  allowed.add('localhost:3000')
  allowed.add('lansbury-ledger.vercel.app')

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  let sourceHost: string | null = null
  if (origin) {
    try {
      sourceHost = new URL(origin).host
    } catch {
      /* ignore */
    }
  }
  if (!sourceHost && referer) {
    try {
      sourceHost = new URL(referer).host
    } catch {
      /* ignore */
    }
  }

  // If no origin header at all, reject — browsers always send it for credentialed fetches
  if (!sourceHost) {
    return Response.json({ error: 'Origin required' }, { status: 403 })
  }
  if (!allowed.has(sourceHost)) {
    return Response.json({ error: 'Forbidden origin' }, { status: 403 })
  }
  return null
}

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/**
 * Fixed-window rate limit per key. Defaults: 20 requests / 60s.
 * In-memory: fine for a single-user app, resets on cold start. Sufficient to stop
 * curl-loops and drive-by abuse; not sufficient for distributed DoS.
 */
export function rateLimit(
  key: string,
  opts: { limit?: number; windowMs?: number } = {}
): Response | null {
  const limit = opts.limit ?? 20
  const windowMs = opts.windowMs ?? 60_000
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  if (bucket.count >= limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
    return Response.json(
      { error: 'Rate limit exceeded' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }
  bucket.count += 1
  return null
}

/** Extract a best-effort client key for rate-limiting. */
export function clientKey(request: Request | NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/**
 * Run the standard guard pair. Returns a Response to short-circuit or null to continue.
 */
export function guardApiRoute(
  request: Request | NextRequest,
  rateLimitOpts?: { limit?: number; windowMs?: number }
): Response | null {
  const origin = checkSameOrigin(request)
  if (origin) return origin
  const rl = rateLimit(clientKey(request), rateLimitOpts)
  if (rl) return rl
  return null
}
