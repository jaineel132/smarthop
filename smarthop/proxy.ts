import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtectedRoute = 
    request.nextUrl.pathname.startsWith('/rider') ||
    request.nextUrl.pathname.startsWith('/driver') ||
    request.nextUrl.pathname.startsWith('/admin')

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  if (user) {
    // Fetch role from public.users
    const { data: userData } = await supabase
      .from('users')
      .select('role, onboarding_complete')
      .eq('id', user.id)
      .maybeSingle()

    // If user is authenticated in Auth but missing in public.users, force onboarding
    if (user && !userData && !isAuthRoute && request.nextUrl.pathname !== '/onboarding') {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }

    if (userData) {
      // Redirect logged-in users away from auth pages
      if (isAuthRoute && request.nextUrl.pathname !== '/auth/callback') {
        const dashboard = userData.role === 'admin' ? '/admin/overview' : `/${userData.role}/dashboard`
        return NextResponse.redirect(new URL(dashboard, request.url))
      }

      // Requirement 9 & 74: Enforce onboarding
      const isOnboardingPath = request.nextUrl.pathname === '/onboarding'
      if (!userData.onboarding_complete && !isOnboardingPath && !isAuthRoute) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
      if (userData.onboarding_complete && isOnboardingPath) {
        const dashboard = userData.role === 'admin' ? '/admin/overview' : `/${userData.role}/dashboard`
        return NextResponse.redirect(new URL(dashboard, request.url))
      }

      const role = userData.role
      const path = request.nextUrl.pathname

      if (path.startsWith('/rider') && role !== 'rider') {
        return NextResponse.redirect(new URL(role === 'admin' ? '/admin/overview' : '/driver/dashboard', request.url))
      }
      if (path.startsWith('/driver') && role !== 'driver') {
        return NextResponse.redirect(new URL(role === 'admin' ? '/admin/overview' : '/rider/dashboard', request.url))
      }
      if (path.startsWith('/admin') && role !== 'admin') {
        return NextResponse.redirect(new URL(role === 'driver' ? '/driver/dashboard' : '/rider/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
