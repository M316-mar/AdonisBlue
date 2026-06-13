import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

/**
 * Signs the user out and wipes ALL locally persisted session data so that
 * navigating to a protected route after logout always redirects to /auth.
 *
 * Call this instead of `supabase.auth.signOut()` directly.
 */
export async function signOutCompletely(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // Best-effort — proceed with local cleanup regardless
  }

  if (typeof window !== 'undefined') {
    // Remove every Supabase key from localStorage
    const keysToDelete: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach((k) => localStorage.removeItem(k))

    // Remove Supabase cookies by setting them to expired
    const cookiePrefixes = ['sb-', 'supabase-']
    document.cookie.split(';').forEach((c) => {
      const name = c.trim().split('=')[0]
      if (cookiePrefixes.some((p) => name.startsWith(p))) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}; SameSite=Lax`
      }
    })

    // Also clear the inactivity cookie
    document.cookie = 'sb_last_active=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax'
  }
}
