import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser()

  // Check if user is deactivated
  if (user) {
    const pathname = request.nextUrl.pathname

    // Skip deactivation check for these paths
    const skipPaths = ['/account-deactivated', '/login', '/signup', '/auth']
    const shouldSkip = skipPaths.some(path => pathname.startsWith(path))

    if (!shouldSkip) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('deactivated_at')
        .eq('id', user.id)
        .single()

      if (profile?.deactivated_at) {
        // User is deactivated - redirect to deactivated page
        const url = request.nextUrl.clone()
        url.pathname = '/account-deactivated'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
