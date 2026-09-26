'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type LoginState = { error: string } | null

export async function signIn(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '/')

  if (!email || !password) {
    return { error: 'Enter your email and password.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Supabase returns the same generic message for "no such user" and
    // "wrong password" - don't narrow it further, that would let someone
    // enumerate valid accounts.
    return { error: 'Invalid email or password.' }
  }

  redirect(next.startsWith('/') ? next : '/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
