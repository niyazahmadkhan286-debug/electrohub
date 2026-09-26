import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for use in the browser (Client Components).
 * Reads the public URL + anon key, which are safe to expose -
 * every table is protected by Row Level Security policies that
 * require an authenticated session for writes.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).',
    )
  }

  return createBrowserClient(url, anonKey)
}
