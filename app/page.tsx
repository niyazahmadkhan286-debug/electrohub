import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardApp } from './dashboard-app'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware already redirects unauthenticated requests to /login; this
  // is a defense-in-depth check in case the page is ever reached directly.
  if (!user) redirect('/login')

  return <DashboardApp userEmail={user.email ?? 'Signed in'} />
}
