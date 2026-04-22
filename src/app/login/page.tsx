'use client'

import { Suspense, useActionState } from 'react'
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

type SignInState = { error?: string } | null

async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  // signIn() will either return {error} or call redirect() (which throws NEXT_REDIRECT).
  // Let the redirect throw propagate — React handles it correctly for form actions.
  const result = await signIn(formData)
  return result ?? null
}

function LoginForm() {
  const params = useSearchParams()
  const next = params.get('next') ?? '/dashboard'
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, null)

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-secondary px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-bg-primary p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-purple/10">
            <Lock className="h-5 w-5 text-accent-purple" />
          </div>
          <h1 className="text-lg font-semibold text-text-primary">Sign in to Rod</h1>
          <p className="text-xs text-text-tertiary">Sole trader accounting, your numbers only.</p>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-text-secondary">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-text-secondary">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-border-subtle bg-bg-primary px-3 py-2 text-sm text-text-primary focus:border-accent-purple focus:outline-none focus:ring-1 focus:ring-accent-purple"
            />
          </div>

          {state?.error && (
            <div className="rounded-lg border border-accent-red/30 bg-surface-red px-3 py-2 text-xs text-accent-red">
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-accent-purple px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
