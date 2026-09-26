'use client'

import { useActionState } from 'react'
import { signIn, type LoginState } from './actions'

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(signIn, null)

  return (
    <form action={formAction}>
      <input type="hidden" name="next" value={next} />
      <label>
        Email
        <input name="email" type="email" required autoComplete="email" placeholder="you@electrohub.com" />
      </label>
      <label>
        Password
        <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
      </label>
      {state?.error && <p className="auth-error">{state.error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
