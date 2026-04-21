'use client'

import { Suspense, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from './actions'
import { Lock } from 'lucide-react'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-text-tertiary">Loading…</div>}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const params = useSearchParams()
  const next = params.get('next') ?? '/dashboard'
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('next', next)
    startTransition(async () => {
      const result = await signIn(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-page px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-primary p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Lock className="h-5 w-5 text-accent-primary" />
          <h1 className="text-lg font-semibold text-text-primary">Sign in to Rod</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-tertiary">Email</label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoFocus
              className="w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-text-tertiary">Password</label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-border-subtle bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none focus:border-accent-primary"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-accent-red/30 bg-surface-red px-3 py-2 text-xs text-accent-red">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-accent-primary py-2.5 text-sm font-semibold text-white active:scale-98 transition-transform disabled:opacity-50"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-text-tertiary">
          Single-user app — accounts are created by the operator in Supabase Auth.
        </p>
      </div>
    </div>
  )
}
