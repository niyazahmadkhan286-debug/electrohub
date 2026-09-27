import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that don't require an authenticated session.
const PUBLIC_PATHS = ['/login']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

// API routes handle their own authentication and return JSON responses.
// Middleware must not turn API requests into HTML login redirects.
function isApiPath(pathname: string) {
  return pathname.startsWith('/api/')
}

function configurationError(request: NextRequest, message: string) {
  console.error('[ElectroHub] Supabase middleware error:', message)
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      { error: 'Authentication service is temporarily unavailable.' },
      { status: 503 },
    )
  }
  return new NextResponse(
    'Authentication service is temporarily unavailable. Check the Supabase configuration and deployment logs.',
    { status: 503 },
  )
}

/**
 * Refresh the Supabase auth session on every request and protect private pages.
 *
 * Important: middleware is fail-closed. If Supabase configuration or auth
 * lookup fails, the request is NOT allowed through as an unauthenticated
 * user. We return a normal HTTP 503 instead of letting an exception escape
 * the middleware and become Vercel's MIDDLEWARE_INVOCATION_FAILED.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return configurationError(
      request,
      'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing',
    )
  }

  let response = NextResponse.next({ request })

  try {
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
      error,
    } = await supabase.auth.getUser()

    if (error) {
      return configurationError(request, `Supabase auth lookup failed: ${error.message}`)
    }

    if (!user && !isPublicPath(pathname) && !isApiPath(pathname)) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }

    if (user && pathname === '/login') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown middleware error'
    return configurationError(request, message)
  }
}
