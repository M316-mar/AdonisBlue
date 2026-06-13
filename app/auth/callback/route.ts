import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Set the proxy session marker so the middleware knows the user is
  // authenticated when it processes the redirect to /dashboard.
  const response = NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
  const isSecure = requestUrl.protocol === 'https:'
  response.cookies.set('adonisblue_session', '1', {
    httpOnly: false, // must be readable by client JS (ActivityTracker, signOutCompletely)
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days — proxy inactivity timeout enforces 30-min window
  })
  return response
}
