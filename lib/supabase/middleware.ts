import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require an authenticated session.
const PUBLIC_PATHS = ['/login']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

// API routes handle their own authentication check and return a proper
// JSON 401 (see lib/api-response.ts / fail()). Redirecting them to /login
// like a page would replace that clean error with an HTML redirect, which
// is wrong for a fetch() caller and for anyone testing the API directly.
// The session cookie is still refreshed for these requests below.
function isApiPath(pathname: string) {
  return pathname.startsWith('/api/')
}

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from private pages, per Supabase's
 * recommended Next.js middleware pattern. This is what makes
 * "view dashboard/products only after login" actually enforced,
 * rather than just hidden in the UI.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    // Misconfigured environment - fail loudly instead of silently
    // letting requests through unauthenticated.
    return new NextResponse(
      'Server misconfiguration: Supabase environment variables are not set.',
      { status: 500 },
    )
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublicPath(pathname) && !isApiPath(pathname)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}
